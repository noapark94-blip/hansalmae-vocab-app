-- Private game data: only the authenticated Edge handler may call these functions.
create table public.battle_friends (
  low_id uuid not null references public.profiles(id) on delete cascade,
  high_id uuid not null references public.profiles(id) on delete cascade,
  requester uuid not null references public.profiles(id) on delete cascade,
  status text not null check(status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key(low_id,high_id), check(low_id<high_id),check(requester in (low_id,high_id))
);
create table public.battle_blocks (
  actor uuid not null references public.profiles(id) on delete cascade,
  target uuid not null references public.profiles(id) on delete cascade,
  primary key(actor,target),check(actor<>target)
);
create table public.battle_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now()
);
create table public.battle_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, window_at timestamptz not null default now(), count integer not null default 0,
  primary key(user_id,kind)
);
create table public.word_battles (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.profiles(id) on delete cascade,
  guest uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check(status in ('invited','ready','playing','finished','declined','cancelled','expired')),
  settings jsonb not null, questions jsonb not null,
  host_ready boolean not null default false, guest_ready boolean not null default false,
  round integer not null default 0, round_at timestamptz, reveal_until timestamptz,
  answers jsonb not null default '{}',host_score integer not null default 0,guest_score integer not null default 0,
  host_ms integer not null default 0,guest_ms integer not null default 0,
  winner uuid,reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(host<>guest),check(jsonb_array_length(questions)=10)
);
create index battle_friends_high on public.battle_friends(high_id);
create index battle_blocks_target on public.battle_blocks(target);
create index word_battles_host on public.word_battles(host,created_at desc);
create index word_battles_guest on public.word_battles(guest,created_at desc);
alter table public.battle_friends enable row level security;
alter table public.battle_blocks enable row level security;
alter table public.battle_presence enable row level security;
alter table public.battle_limits enable row level security;
alter table public.word_battles enable row level security;
revoke all on public.battle_friends,public.battle_blocks,public.battle_presence,public.battle_limits,public.word_battles from anon,authenticated;
grant all on public.battle_friends,public.battle_blocks,public.battle_presence,public.battle_limits,public.word_battles to service_role;

create function public.battle_person(p_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('id',p.id,'name',p.display_name,'level',coalesce(x.level,1),'title',coalesce(x.title,'단어병아리'),
 'image',coalesce((select e.image_path from student_emblems se join emblem_settings e on e.id=se.emblem_id where se.user_id=p.id and se.equipped and e.enabled limit 1),'./images/emblems/title-chick.png'),
 'online',coalesce(bp.seen_at>now()-interval '45 seconds',false),
 'busy',exists(select 1 from word_battles b where p.id in(b.host,b.guest) and b.status in('invited','ready','playing') and b.updated_at>now()-interval '2 minutes'))
 from profiles p left join student_experience x on x.user_id=p.id left join battle_presence bp on bp.user_id=p.id where p.id=p_id and p.role='student' and p.enabled;
$$;

create function public.battle_social(p_actor uuid,p_action text,p_target uuid default null,p_search text default '') returns jsonb
language plpgsql security invoker set search_path=public as $$
declare lo uuid;hi uuid;f battle_friends; found_id uuid; n integer;lim battle_limits;
begin
 if not exists(select 1 from profiles where id=p_actor and enabled and role='student') then raise exception '학생 로그인이 필요합니다.';end if;
 insert into battle_presence(user_id) values(p_actor) on conflict(user_id) do update set seen_at=now();
 if p_action in('search','request') then
  insert into battle_limits(user_id,kind) values(p_actor,p_action) on conflict do nothing;
  select * into lim from battle_limits where user_id=p_actor and kind=p_action for update;
  if lim.window_at<now()-interval '1 hour' then lim.count:=0;lim.window_at:=now();end if;
  if lim.count >= (case when p_action='search' then 60 else 20 end) then raise exception '요청이 많아요. 잠시 후 다시 시도해주세요.';end if;
  update battle_limits set count=lim.count+1,window_at=lim.window_at where user_id=p_actor and kind=p_action;
 end if;
 if p_action='search' then
  if length(trim(p_search))<2 or length(p_search)>80 then raise exception '정확한 학생 아이디를 입력해주세요.';end if;
  select id into found_id from profiles where student_id=trim(p_search) and role='student' and enabled and id<>p_actor limit 1;
  if exists(select 1 from battle_blocks where (actor=p_actor and target=found_id) or(actor=found_id and target=p_actor)) then found_id:=null;end if;
  return jsonb_build_object('person',battle_person(found_id));
 end if;
 if p_action in('request','accept','remove','decline','block','unblock') then
  if p_actor=p_target or p_target is null then raise exception '친구를 확인해주세요.';end if;
  lo:=least(p_actor,p_target);hi:=greatest(p_actor,p_target);
  perform pg_advisory_xact_lock(hashtextextended(lo::text,91));perform pg_advisory_xact_lock(hashtextextended(hi::text,91));
  if not exists(select 1 from profiles where id=p_target and enabled and role='student') then raise exception '사용할 수 없는 학생 계정입니다.';end if;
  select * into f from battle_friends where low_id=lo and high_id=hi for update;
  if p_action='block' then
   insert into battle_blocks(actor,target) values(p_actor,p_target) on conflict do nothing;
   delete from battle_friends where low_id=lo and high_id=hi;
  elsif p_action='unblock' then delete from battle_blocks where actor=p_actor and target=p_target;
  elsif p_action in('remove','decline') then delete from battle_friends where low_id=lo and high_id=hi;
  else
   if exists(select 1 from battle_blocks where (actor=lo and target=hi) or(actor=hi and target=lo)) then raise exception '친구 요청을 보낼 수 없습니다.';end if;
   if p_action='request' and f.low_id is null then
    select count(*) into n from battle_friends where p_actor in(low_id,high_id);
    if n>=100 then raise exception '친구와 대기 요청은 100명까지 등록할 수 있어요.';end if;
    insert into battle_friends values(lo,hi,p_actor,'pending',now());
   elsif p_action='accept' then
    if f.status<>'pending' or f.requester=p_actor or f.low_id is null then raise exception '받은 친구 요청을 확인해주세요.';end if;
    update battle_friends set status='accepted' where low_id=lo and high_id=hi;
   end if;
  end if;
 end if;
 return jsonb_build_object('me',battle_person(p_actor),'friends',coalesce((select jsonb_agg(battle_person(case when low_id=p_actor then high_id else low_id end)||jsonb_build_object('status',status,'incoming',requester<>p_actor)) from battle_friends where p_actor in(low_id,high_id)),'[]'::jsonb),
 'blocked',coalesce((select jsonb_agg(battle_person(target)) from battle_blocks where actor=p_actor),'[]'::jsonb),
 'battles',coalesce((select jsonb_agg(to_jsonb(t)) from(select b.id,b.status,b.settings,b.host,b.guest,b.created_at,b.winner,b.reason,b.host_score,b.guest_score,b.host_ms,b.guest_ms,battle_person(case when b.host=p_actor then b.guest else b.host end) as opponent from word_battles b where p_actor in(b.host,b.guest) and (b.status in('finished','declined','cancelled','expired') or b.updated_at>now()-interval '2 minutes') order by b.created_at desc limit 12)t),'[]'::jsonb));
end; $$;

create function public.battle_play(p_actor uuid,p_action text,p_id uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path=public as $$
declare b word_battles;t uuid;lo uuid;hi uuid;q jsonb;answer_key text;h jsonb;g jsonb;reveal boolean;review jsonb;fresh timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from profiles where id=p_actor and enabled and role='student') then raise exception '학생 로그인이 필요합니다.';end if;
 insert into battle_presence(user_id) values(p_actor) on conflict(user_id) do update set seen_at=now();
 if p_action='invite' then
  t:=(p_payload->>'target')::uuid;lo:=least(p_actor,t);hi:=greatest(p_actor,t);
  if t is null or t=p_actor then raise exception '친구를 확인해주세요.';end if;
  perform pg_advisory_xact_lock(hashtextextended(lo::text,91));perform pg_advisory_xact_lock(hashtextextended(hi::text,91));
  if not exists(select 1 from battle_friends where low_id=lo and high_id=hi and status='accepted') or exists(select 1 from battle_blocks where (actor=lo and target=hi) or(actor=hi and target=lo)) then raise exception '수락한 친구에게만 대전을 신청할 수 있어요.';end if;
  if not exists(select 1 from profiles where id=t and enabled and role='student') then raise exception '친구 계정을 확인해주세요.';end if;
  update word_battles set status='expired',reason='대기 시간이 지났어요.' where status in('invited','ready','playing') and updated_at<fresh-interval '2 minutes' and (host in(lo,hi) or guest in(lo,hi));
  if exists(select 1 from word_battles where status in('invited','ready','playing') and(host in(lo,hi) or guest in(lo,hi))) then raise exception '진행 중인 대전을 먼저 마쳐주세요.';end if;
  if (select count(*) from word_battles where host=p_actor and created_at>fresh-interval '1 minute')>=3 then raise exception '대전 신청은 잠시 후 다시 보내주세요.';end if;
  insert into word_battles(host,guest,settings,questions) values(p_actor,t,p_payload->'settings',p_payload->'questions') returning * into b;
 else
  select * into b from word_battles where id=p_id and p_actor in(host,guest) for update;
  if b.id is null then raise exception '대전에 참여할 수 없습니다.';end if;
 end if;
 if b.status in('invited','ready') and b.created_at<fresh-interval '2 minutes' then b.status:='expired';b.reason:='대기 시간이 지났어요.';end if;
 if b.status in('invited','ready','playing') and (not exists(select 1 from battle_friends where low_id=least(b.host,b.guest) and high_id=greatest(b.host,b.guest) and status='accepted') or exists(select 1 from battle_blocks where (actor=b.host and target=b.guest) or(actor=b.guest and target=b.host))) then b.status:='cancelled';b.reason:='친구 관계가 변경되어 대전이 종료됐어요.';end if;
 if p_action='accept' and b.status='invited' then
  if p_actor<>b.guest then raise exception '상대의 수락을 기다려주세요.';end if;b.status:='ready';
 elsif p_action='decline' and b.status='invited' then
  b.status:=case when p_actor=b.guest then 'declined' else 'cancelled' end;
 elsif p_action='leave' and b.status in('invited','ready','playing') then
  b.reason:='상대가 대전을 종료했어요.';
  if b.status='playing' then b.status:='finished';b.winner:=case when p_actor=b.host then b.guest else b.host end;else b.status:='cancelled';end if;
 elsif p_action='ready' and b.status='ready' then
  if p_actor=b.host then b.host_ready:=true;else b.guest_ready:=true;end if;
  if b.host_ready and b.guest_ready then b.status:='playing';b.round_at:=fresh+interval '3 seconds';end if;
 end if;
 if b.status='playing' then
  if b.updated_at<fresh-interval '2 minutes' then b.status:='expired';b.reason:='연결이 끊겨 대전을 종료했어요.';
  else
   if b.reveal_until is not null and fresh>=b.reveal_until then
    if b.round=9 then
     b.status:='finished';
     b.winner:=case when b.host_score>b.guest_score or(b.host_score=b.guest_score and b.host_ms<b.guest_ms) then b.host when b.guest_score>b.host_score or(b.host_score=b.guest_score and b.guest_ms<b.host_ms) then b.guest else null end;
    else b.round:=b.round+1;b.round_at:=fresh+interval '1 second';b.reveal_until:=null;end if;
   end if;
   if b.status='playing' and b.reveal_until is null then
    q:=b.questions->b.round;answer_key:=b.round::text||':'||p_actor::text;
    if p_action='answer' and (p_payload->>'round')::integer=b.round and fresh>=b.round_at and fresh<b.round_at+interval '20 seconds' and not(b.answers?answer_key) then
     if not exists(select 1 from jsonb_array_elements(q->'options')o where o->>'id'=p_payload->>'choice') then raise exception '보기를 확인해주세요.';end if;
     b.answers:=b.answers||jsonb_build_object(answer_key,jsonb_build_object('choice',p_payload->>'choice','ms',greatest(0,floor(extract(epoch from(fresh-b.round_at))*1000)::integer)));
    end if;
    h:=b.answers->(b.round::text||':'||b.host::text);g:=b.answers->(b.round::text||':'||b.guest::text);
    if (h is not null and g is not null) or fresh>=b.round_at+interval '20 seconds' then
     if h->>'choice'=q->>'correctId' then b.host_score:=b.host_score+1;b.host_ms:=b.host_ms+(h->>'ms')::integer;end if;
     if g->>'choice'=q->>'correctId' then b.guest_score:=b.guest_score+1;b.guest_ms:=b.guest_ms+(g->>'ms')::integer;end if;
     b.reveal_until:=fresh+interval '2 seconds';
    end if;
   end if;
  end if;
 end if;
 update word_battles set status=b.status,host_ready=b.host_ready,guest_ready=b.guest_ready,round=b.round,round_at=b.round_at,reveal_until=b.reveal_until,answers=b.answers,host_score=b.host_score,guest_score=b.guest_score,host_ms=b.host_ms,guest_ms=b.guest_ms,winner=b.winner,reason=b.reason,updated_at=case when b.status in('invited','ready') then updated_at else fresh end where id=b.id;
 q:=b.questions->b.round;reveal:=b.reveal_until is not null;
 if b.status='finished' then
  select coalesce(jsonb_agg(jsonb_build_object('word',v->>'word','meaning',v->>'meaning','example',v->>'example','translation',v->>'translation','correct',coalesce((b.answers->((ord-1)::text||':'||p_actor::text)->>'choice')=v->>'correctId',false)) order by ord),'[]'::jsonb) into review from jsonb_array_elements(b.questions) with ordinality as a(v,ord);
 end if;
 return jsonb_build_object('id',b.id,'status',b.status,'settings',b.settings,'me',p_actor,'host',battle_person(b.host),'guest',battle_person(b.guest),'hostReady',b.host_ready,'guestReady',b.guest_ready,'round',b.round,'roundAt',b.round_at,'deadline',b.round_at+interval '20 seconds','revealUntil',b.reveal_until,'serverNow',fresh,'hostScore',b.host_score,'guestScore',b.guest_score,'hostMs',b.host_ms,'guestMs',b.guest_ms,'winner',b.winner,'reason',b.reason,
 'answered',b.answers?(b.round::text||':'||p_actor::text),'opponentAnswered',b.answers?(b.round::text||':'||(case when p_actor=b.host then b.guest else b.host end)::text),
 'choice',b.answers->(b.round::text||':'||p_actor::text)->>'choice',
 'question',case when b.status='playing' and fresh>=b.round_at then jsonb_build_object('prompt',q->>'prompt','options',case when p_actor=b.host then q->'options' else (select jsonb_agg(value order by ord desc) from jsonb_array_elements(q->'options') with ordinality as a(value,ord)) end,'mode',q->>'mode','correctId',case when reveal then q->>'correctId' else null end) else null end,'review',review);
end; $$;
revoke all on function public.battle_person(uuid),public.battle_social(uuid,text,uuid,text),public.battle_play(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.battle_person(uuid),public.battle_social(uuid,text,uuid,text),public.battle_play(uuid,text,uuid,jsonb) to service_role;

create function public.battle_catalog(p_actor uuid,p_target uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from battle_friends where low_id=least(p_actor,p_target) and high_id=greatest(p_actor,p_target) and status='accepted') or exists(select 1 from battle_blocks where (actor=p_actor and target=p_target) or(actor=p_target and target=p_actor)) then raise exception '친구 수락 후 대전할 수 있어요.';end if;
 return coalesce((select jsonb_agg(to_jsonb(s)) from (
 select ws.id,ws.name as title,'standard' as kind,coalesce((select jsonb_agg(d.day order by d.day) from(select distinct day from words where word_set_id=ws.id)d),'[]'::jsonb) as days from word_sets ws where ws.enabled
 union all select b.id,b.title,'school','[1]'::jsonb from school_vocab_books b where b.enabled and exists(select 1 from school_vocab_assignments where book_id=b.id and user_id=p_actor) and exists(select 1 from school_vocab_assignments where book_id=b.id and user_id=p_target)
 )s),'[]'::jsonb);
end; $$;
revoke all on function public.battle_catalog(uuid,uuid) from public,anon,authenticated;
grant execute on function public.battle_catalog(uuid,uuid) to service_role;
