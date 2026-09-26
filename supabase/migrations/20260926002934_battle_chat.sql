-- Private, bounded per-match chat. Authenticated Edge handler supplies the actor.
create table public.battle_messages (
 id bigint generated always as identity primary key,
 battle_id uuid not null references public.word_battles(id) on delete cascade,
 sender uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('text','emoji')),
 body text not null check(char_length(body) between 1 and 160),
 created_at timestamptz not null default clock_timestamp()
);
create index battle_messages_room on public.battle_messages(battle_id,id desc);
alter table public.battle_messages enable row level security;
revoke all on public.battle_messages from public,anon,authenticated;
grant all on public.battle_messages to service_role;
grant usage,select on sequence public.battle_messages_id_seq to service_role;
create function public.battle_chat(p_actor uuid,p_battle uuid,p_kind text default null,p_body text default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare b word_battles; last_sent timestamptz; content text:=btrim(coalesce(p_body,''));
begin
 if not exists(select 1 from profiles where id=p_actor and enabled and role='student') then raise exception '학생 로그인이 필요합니다.';end if;
 -- Serialize sending with readiness/finish transitions and other sends.
 if p_kind is not null then
  select * into b from word_battles where id=p_battle and p_actor in(host,guest) for update;
 else
  select * into b from word_battles where id=p_battle and p_actor in(host,guest);
 end if;
 if b.id is null then raise exception '대전 참여자만 채팅을 볼 수 있어요.';end if;
 if exists(select 1 from battle_blocks where (actor=b.host and target=b.guest) or (actor=b.guest and target=b.host)) then
  if p_kind is not null then raise exception '이 대전에서는 채팅을 보낼 수 없어요.';end if;
  return jsonb_build_object('messages','[]'::jsonb,'serverNow',clock_timestamp());
 end if;
 if p_kind is not null then
  if b.status not in ('invited','ready','playing') or b.updated_at<clock_timestamp()-interval '2 minutes' or (b.status in ('invited','ready') and b.created_at<clock_timestamp()-interval '2 minutes') then raise exception '대전이 종료되어 보낼 수 없어요.';end if;
  if p_kind not in ('text','emoji') then raise exception '지원하지 않는 메시지예요.';end if;
  if p_kind='text' and b.status not in ('invited','ready') then raise exception '경기 중에는 이모티콘만 보낼 수 있어요.';end if;
  if char_length(content) not between 1 and 160 then raise exception '메시지는 1~160자로 입력해주세요.';end if;
  if p_kind='emoji' and content not in ('😛','😆','😭','👏','💗') then raise exception '이모티콘을 다시 선택해주세요.';end if;
  select max(created_at) into last_sent from battle_messages where battle_id=b.id and sender=p_actor;
  if last_sent>clock_timestamp()-make_interval(secs=>case when p_kind='emoji' then 3 else 1 end) then raise exception '잠시 후 다시 보내주세요.';end if;
  insert into battle_messages(battle_id,sender,kind,body) values(b.id,p_actor,p_kind,content);
  delete from battle_messages where battle_id=b.id and id not in(select id from battle_messages where battle_id=b.id order by id desc limit 40);
 end if;
 return jsonb_build_object('messages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'sender',sender,'kind',kind,'body',body,'at',created_at) order by id) from battle_messages where battle_id=b.id),'[]'::jsonb),'serverNow',clock_timestamp());
end; $$;
revoke all on function public.battle_chat(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.battle_chat(uuid,uuid,text,text) to service_role;
