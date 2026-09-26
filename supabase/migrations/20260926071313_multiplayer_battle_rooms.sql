-- Service-only, server-authoritative 2–8 player rooms. Existing 1:1 games stay readable.
create table public.battle_rooms (
 id uuid primary key default gen_random_uuid(),host uuid not null references public.profiles(id),
 title text not null check(char_length(title) between 1 and 40),capacity integer not null check(capacity between 2 and 8),
 next_room uuid references public.battle_rooms(id),password_hash text,settings jsonb not null,questions jsonb not null default '[]',
 status text not null default 'waiting' check(status in('waiting','playing','finished','closed')),
 round integer not null default 0,round_at timestamptz,reveal_until timestamptz,
 answers jsonb not null default '{}',reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.battle_room_members (
 room_id uuid references public.battle_rooms(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,
 seat integer not null check(seat between 0 and 7),person jsonb not null,ready boolean not null default false,
 score integer not null default 0,elapsed_ms integer not null default 0,left_at timestamptz,
 seen_at timestamptz not null default now(),joined_at timestamptz not null default now(),primary key(room_id,user_id)
);
create unique index battle_room_seats on public.battle_room_members(room_id,seat) where left_at is null;
create index battle_room_user on public.battle_room_members(user_id,room_id);
create index battle_rooms_live on public.battle_rooms(status,updated_at);
create table public.battle_room_messages (
 id bigint generated always as identity primary key,room_id uuid references public.battle_rooms(id) on delete cascade,
 sender uuid references public.profiles(id) on delete cascade,kind text not null check(kind in('text','emoji')),
 body text not null check(char_length(body) between 1 and 160),created_at timestamptz not null default now()
);
create index battle_room_chat on public.battle_room_messages(room_id,id desc);
create index battle_room_sender on public.battle_room_messages(sender);
create table public.battle_room_attempts(user_id uuid primary key references public.profiles(id) on delete cascade,attempts integer not null default 0,window_at timestamptz not null default now());
create table public.battle_room_rewards (
 room_id uuid references public.battle_rooms(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,
 opponents uuid[] not null,reward_day date not null,eligible_count integer not null,points integer not null,xp integer not null,
 primary key(room_id,user_id)
);
create index battle_room_rewards_daily on public.battle_room_rewards(user_id,reward_day);
alter table public.battle_rooms enable row level security;
alter table public.battle_room_members enable row level security;
alter table public.battle_room_messages enable row level security;
alter table public.battle_room_attempts enable row level security;
alter table public.battle_room_rewards enable row level security;
revoke all on public.battle_rooms,public.battle_room_members,public.battle_room_messages,public.battle_room_attempts,public.battle_room_rewards from public,anon,authenticated;
grant all on public.battle_rooms,public.battle_room_members,public.battle_room_messages,public.battle_room_attempts,public.battle_room_rewards to service_role;
grant usage,select on sequence public.battle_room_messages_id_seq to service_role;

create function public.battle_room_catalog(p_actor uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (
 select ws.id,ws.name title,'standard' kind,coalesce((select jsonb_agg(day order by day) from(select distinct day from words where word_set_id=ws.id)d),'[]'::jsonb) days from word_sets ws where ws.enabled
 union all select b.id,b.title,'school','[1]'::jsonb from school_vocab_books b where b.enabled and exists(select 1 from school_vocab_assignments where book_id=b.id and user_id=p_actor)
 )s where exists(select 1 from profiles where id=p_actor and enabled and role='student');
$$;
create function public.battle_room_allowed(p_actor uuid,p_settings jsonb) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from jsonb_array_elements(battle_room_catalog(p_actor)) s where s->>'id'=p_settings->>'source' and s->>'kind'=p_settings->>'kind');
$$;
-- Share the daily cap with the existing 1:1 reward ledger.
create or replace function public.battle_reward_allowance(p_actor uuid,p_target uuid default null) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('remaining',greatest(0,100-coalesce(sum(n),0)),'pairRemaining',greatest(0,3-coalesce(sum(pair),0)),'dailyLimit',100,'pairLimit',3) from (
 select eligible_count n,case when opponent_id=p_target then 1 else 0 end pair from battle_rewards where user_id=p_actor and reward_day=(now() at time zone 'Asia/Seoul')::date
 union all select eligible_count,case when p_target=any(opponents) then 1 else 0 end from battle_room_rewards where user_id=p_actor and reward_day=(now() at time zone 'Asia/Seoul')::date
 )s;
$$;
create function public.battle_room_settle(p_room uuid) returns void language plpgsql security invoker set search_path=public as $$
declare r battle_rooms;m record;allowed integer;correct integer;pts integer;xp integer;n integer;top_score integer;top_ms integer;set_id uuid;opponents uuid[];group_name text;place integer;pair_left integer;
begin
 select * into r from battle_rooms where id=p_room for update;
 if r.status<>'finished' then return;end if;n:=jsonb_array_length(r.questions);
 for m in select * from battle_room_members where room_id=r.id order by user_id loop
  perform pg_advisory_xact_lock(hashtextextended(m.user_id::text,192));
 end loop;
 select score,elapsed_ms into top_score,top_ms from battle_room_members where room_id=r.id and left_at is null order by score desc,elapsed_ms limit 1;
 for m in select * from battle_room_members where room_id=r.id order by user_id loop
  if exists(select 1 from battle_room_rewards where room_id=r.id and user_id=m.user_id) then continue;end if;
  select array_agg(user_id) into opponents from battle_room_members where room_id=r.id and user_id<>m.user_id;
  select min((battle_reward_allowance(m.user_id,u)->>'pairRemaining')::integer) into pair_left from unnest(opponents)u;
  allowed:=least(n,(battle_reward_allowance(m.user_id)->>'remaining')::integer);
  if m.left_at is not null or r.reason is not null or pair_left=0 then allowed:=0;end if;
  select count(*) into correct from jsonb_array_elements(r.questions) with ordinality q(v,i) where i<=allowed and r.answers->((i-1)::text||':'||m.user_id::text)->>'choice'=v->>'correctId';
  select count(*)+1 into place from battle_room_members where room_id=r.id and left_at is null and (score>m.score or(score=m.score and elapsed_ms<m.elapsed_ms));
  pts:=floor((case when m.score=top_score and m.elapsed_ms=top_ms then 5 when place=2 then 3 else 1 end)*allowed/10.0);xp:=correct*2+floor(5*allowed/10.0);
  if allowed>0 then
   if r.settings->>'kind'='standard' then set_id:=(r.settings->>'source')::uuid;
   else
    select ranking_grade_group(base_grade,base_year,date_trunc('month',now() at time zone 'Asia/Seoul')::date) into group_name from profiles where id=m.user_id;
    select id into set_id from word_sets where enabled and ranking_category_from_name(name)=coalesce(group_name,'middle') order by name,id limit 1;
   end if;
   perform save_student_test_result_atomic(m.user_id,gen_random_uuid(),jsonb_build_object('test_kind','battle','word_set_id',set_id,'question_type',r.settings->>'mode','start_day',r.settings->'start','end_day',r.settings->'end','question_count',allowed,'correct_count',correct,'score',round(correct*100.0/allowed),'grade',case when place=1 then 'WIN' else 'LOSE' end,'points',pts,'raw_result',jsonb_build_object('source','battle','roomId',r.id,'title',r.title,'place',place)),'[]',xp,'room:'||r.id||':'||m.user_id);
  end if;
  insert into battle_room_rewards values(r.id,m.user_id,coalesce(opponents,'{}'),(now() at time zone 'Asia/Seoul')::date,allowed,pts,xp);
 end loop;
end;$$;

create function public.battle_room_view(p_room uuid,p_actor uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare r battle_rooms;q jsonb;review jsonb;fresh timestamptz:=clock_timestamp();
begin
 select * into r from battle_rooms where id=p_room;
 if not exists(select 1 from battle_room_members where room_id=r.id and user_id=p_actor) then raise exception '참가한 방만 볼 수 있어요.';end if;
 q:=r.questions->r.round;
 if r.status='finished' then
  select jsonb_agg(jsonb_build_object('word',v->>'word','meaning',v->>'meaning','example',v->>'example','translation',v->>'translation','correct',coalesce(r.answers->((i-1)::text||':'||p_actor::text)->>'choice'=v->>'correctId',false)) order by i) into review from jsonb_array_elements(r.questions) with ordinality t(v,i);
 end if;
 return jsonb_build_object('id',r.id,'title',r.title,'capacity',r.capacity,'host',r.host,'me',p_actor,'status',r.status,'settings',r.settings,'reason',r.reason,'nextRoom',r.next_room,'serverNow',fresh,'round',r.round,'roundAt',r.round_at,'deadline',r.round_at+make_interval(secs=>(r.settings->>'seconds')::integer),'revealUntil',r.reveal_until,
 'members',coalesce((select jsonb_agg(person||jsonb_build_object('id',user_id,'seat',seat,'ready',ready,'score',score,'ms',elapsed_ms,'left',left_at is not null,'online',seen_at>fresh-interval '35 seconds','answered',r.answers ? (r.round::text||':'||user_id::text)) order by seat) from battle_room_members where room_id=r.id),'[]'),
 'question',case when r.status='playing' and fresh>=r.round_at then jsonb_build_object('prompt',q->>'prompt','mode',q->>'mode','options',(select jsonb_agg(value order by md5(value->>'id'||p_actor::text)) from jsonb_array_elements(q->'options')),'correctId',case when r.reveal_until is not null then q->>'correctId' else null end) else null end,
 'answered',r.answers ? (r.round::text||':'||p_actor::text),'choice',r.answers->(r.round::text||':'||p_actor::text)->>'choice','review',review,
 'chat',coalesce((select jsonb_agg(to_jsonb(msg) order by id) from(select id,sender,kind,body,created_at at from battle_room_messages where room_id=r.id order by id desc limit 40)msg),'[]'),
 'reward',(select jsonb_build_object('points',points,'xp',xp,'eligibleCount',eligible_count) from battle_room_rewards where room_id=r.id and user_id=p_actor));
end;$$;

create function public.battle_room_play(p_actor uuid,p_action text,p_id uuid default null,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare r battle_rooms;me_member battle_room_members;fresh timestamptz:=clock_timestamp();n integer;seat_no integer;q jsonb;key text;content text;kind text;last_sent timestamptz;u uuid;
begin
 if not exists(select 1 from profiles where id=p_actor and enabled and role='student') then raise exception '학생 로그인이 필요합니다.';end if;
 -- Consistent actor lock for joining/creating, room row lock for all gameplay mutations.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,91));
 if p_action in('lobby','create','join') then
  update battle_rooms set status='closed',reason='오래 비어 있던 방이 정리됐어요.' where status in('waiting','playing') and updated_at<fresh-interval '3 minutes';
 end if;
 if p_action='lobby' then
  return jsonb_build_object('me',battle_person(p_actor),'rooms',coalesce((select jsonb_agg(v order by joined desc,waiting desc,created desc) from(
   select r.created_at created,r.status='waiting' waiting,exists(select 1 from battle_room_members where room_id=r.id and user_id=p_actor and left_at is null) joined,
    jsonb_build_object('id',r.id,'title',r.title,'host',battle_person(r.host),'capacity',r.capacity,'status',r.status,'locked',r.password_hash is not null,'settings',r.settings,'joined',exists(select 1 from battle_room_members where room_id=r.id and user_id=p_actor and left_at is null),'members',(select coalesce(jsonb_agg(person order by seat),'[]') from battle_room_members where room_id=r.id and left_at is null)) v
   from battle_rooms r where r.status in('waiting','playing') and battle_room_allowed(p_actor,r.settings) and not exists(select 1 from battle_room_members m join battle_blocks b on (b.actor=p_actor and b.target=m.user_id) or(b.target=p_actor and b.actor=m.user_id) where m.room_id=r.id and m.left_at is null) order by r.created_at desc limit 60
  )x),'[]'));
 elsif p_action in('create','join') then
  if exists(select 1 from word_battles where p_actor in(host,guest) and status in('invited','ready','playing') and updated_at>fresh-interval '2 minutes') then raise exception '기존 대전을 먼저 마쳐주세요.';end if;
  if exists(select 1 from battle_room_members m join battle_rooms b on b.id=m.room_id where m.user_id=p_actor and m.left_at is null and b.status in('waiting','playing') and b.id is distinct from p_id) then raise exception '참가 중인 방을 먼저 나와주세요.';end if;
  if p_action='create' then
   if (select count(*) from battle_rooms where host=p_actor and created_at>fresh-interval '1 minute')>=3 then raise exception '방 만들기는 잠시 후 다시 해주세요.';end if;
   if not battle_room_allowed(p_actor,p_payload->'settings') then raise exception '이용 가능한 단어장을 선택해주세요.';end if;
   if char_length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 40 or (p_payload->>'capacity')::integer not between 2 and 8 then raise exception '방 이름과 인원수를 확인해주세요.';end if;
   if (p_payload->'settings'->>'count')::integer not in(10,20,30) or (p_payload->'settings'->>'seconds')::integer not in(10,15,20) then raise exception '문제 설정을 확인해주세요.';end if;
   insert into battle_rooms(host,title,capacity,settings,password_hash) values(p_actor,btrim(p_payload->>'title'),(p_payload->>'capacity')::integer,p_payload->'settings',case when coalesce(p_payload->>'password','')<>'' then extensions.crypt(p_payload->>'password',extensions.gen_salt('bf',6)) else null end) returning * into r;
   insert into battle_room_members(room_id,user_id,seat,person) values(r.id,p_actor,0,battle_person(p_actor));
   return battle_room_view(r.id,p_actor);
  end if;
 end if;
 select * into r from battle_rooms where id=p_id for update;
 if r.id is null then raise exception '방이 종료되었거나 없어졌어요.';end if;
 if p_action='join' then
  if exists(select 1 from battle_room_members where room_id=r.id and user_id=p_actor and left_at is null) then
   update battle_room_members set seen_at=fresh where room_id=r.id and user_id=p_actor;
   return battle_room_view(r.id,p_actor);
  end if;
  if r.status<>'waiting' then raise exception '이미 시작했거나 종료된 방이에요.';end if;
  delete from battle_room_members where room_id=r.id and seen_at<fresh-interval '90 seconds';
  if (select count(*) from battle_room_members where room_id=r.id and left_at is null)>=r.capacity then raise exception '방이 가득 찼어요.';end if;
  if not battle_room_allowed(p_actor,r.settings) then raise exception '배정받은 단어장의 방만 입장할 수 있어요.';end if;
  if exists(select 1 from battle_room_members m join battle_blocks b on (b.actor=p_actor and b.target=m.user_id) or(b.target=p_actor and b.actor=m.user_id) where m.room_id=r.id and m.left_at is null) then raise exception '이 방에는 입장할 수 없어요.';end if;
  insert into battle_room_attempts(user_id,attempts,window_at) values(p_actor,1,fresh) on conflict(user_id) do update set attempts=case when battle_room_attempts.window_at<fresh-interval '1 minute' then 1 else battle_room_attempts.attempts+1 end,window_at=case when battle_room_attempts.window_at<fresh-interval '1 minute' then fresh else battle_room_attempts.window_at end;
  if (select attempts from battle_room_attempts where user_id=p_actor)>8 then return jsonb_build_object('error','입장 시도는 1분 후 다시 해주세요.');end if;
  if r.password_hash is not null and not exists(select 1 from battle_rooms old join battle_room_members om on om.room_id=old.id where old.next_room=r.id and om.user_id=p_actor and om.left_at is null) and extensions.crypt(coalesce(p_payload->>'password',''),r.password_hash)<>r.password_hash then return jsonb_build_object('error','비밀번호가 맞지 않아요.');end if;
  select i into seat_no from generate_series(0,r.capacity-1)i where not exists(select 1 from battle_room_members where room_id=r.id and seat=i and left_at is null) order by i limit 1;
  insert into battle_room_members(room_id,user_id,seat,person) values(r.id,p_actor,seat_no,battle_person(p_actor)) on conflict(room_id,user_id) do update set seat=excluded.seat,person=excluded.person,ready=false,left_at=null,seen_at=fresh;
  update battle_room_members set ready=false where room_id=r.id;
 else
  select * into me_member from battle_room_members where room_id=r.id and user_id=p_actor;
  if me_member.user_id is null then raise exception '참가한 방만 볼 수 있어요.';end if;
  if me_member.left_at is not null and p_action<>'poll' then raise exception '이미 나간 대전이에요.';end if;
  if r.status='waiting' then delete from battle_room_members where room_id=r.id and seen_at<fresh-interval '90 seconds' and user_id<>p_actor;end if;
  update battle_room_members set seen_at=fresh where room_id=r.id and user_id=p_actor and left_at is null;
  if p_action='leave' then
   if r.status='waiting' then delete from battle_room_members where room_id=r.id and user_id=p_actor;update battle_room_members set ready=false where room_id=r.id;
   else update battle_room_members set left_at=coalesce(left_at,fresh) where room_id=r.id and user_id=p_actor;end if;
  elsif p_action='ready' and r.status='waiting' then
   update battle_room_members set ready=coalesce((p_payload->>'ready')::boolean,not ready) where room_id=r.id and user_id=p_actor;
  elsif p_action='settings' then
   if r.host<>p_actor or r.status<>'waiting' then raise exception '방장만 시작할 수 있어요.';end if;
   return r.settings;
  elsif p_action='start' then
   if r.host<>p_actor then raise exception '방장만 시작할 수 있어요.';end if;
   if r.status='waiting' then
    if (select count(*) from battle_room_members where room_id=r.id)<2 or exists(select 1 from battle_room_members where room_id=r.id and(not ready or seen_at<fresh-interval '35 seconds')) then raise exception '2명 이상 모두 준비한 뒤 시작해주세요.';end if;
    if exists(select 1 from battle_room_members where room_id=r.id and not battle_room_allowed(user_id,r.settings)) then raise exception '참가자의 단어장 배정이 변경됐어요.';end if;
    if jsonb_array_length(p_payload->'questions')<>(r.settings->>'count')::integer then raise exception '문제를 다시 생성해주세요.';end if;
    r.questions:=p_payload->'questions';r.status:='playing';r.round:=0;r.round_at:=fresh+interval '3 seconds';
    update battle_room_members set person=battle_person(user_id) where room_id=r.id;
   end if;
  elsif p_action='chat' then
   content:=btrim(coalesce(p_payload->>'body',''));kind:=p_payload->>'kind';
   if r.status not in('waiting','playing','finished') or (kind='text' and r.status='playing') then raise exception '경기 중에는 이모티콘만 보낼 수 있어요.';end if;
   if kind not in('text','emoji') or char_length(content) not between 1 and 160 then raise exception '메시지는 1~160자로 입력해주세요.';end if;
   if kind='emoji' and content not in('👋','😂','🔥','👍','😭','👏','💗') then raise exception '이모티콘을 다시 선택해주세요.';end if;
   select max(created_at) into last_sent from battle_room_messages where room_id=r.id and sender=p_actor;
   if last_sent>fresh-make_interval(secs=>case when kind='emoji' then 3 else 1 end) then raise exception '잠시 후 다시 보내주세요.';end if;
   insert into battle_room_messages(room_id,sender,kind,body) values(r.id,p_actor,kind,content);
   delete from battle_room_messages where room_id=r.id and id not in(select id from battle_room_messages where room_id=r.id order by id desc limit 40);
  elsif p_action='rematch' and r.status='finished' then
   if exists(select 1 from battle_room_members member join battle_rooms other on other.id=member.room_id where member.user_id=p_actor and member.left_at is null and other.status in('waiting','playing') and other.id is distinct from r.next_room) then raise exception '참가 중인 방을 먼저 나와주세요.';end if;
   if r.host<>p_actor then raise exception '방장이 재대전을 열 수 있어요.';end if;
   if r.next_room is not null then return battle_room_view(r.next_room,p_actor);end if;
   u:=r.id;
   insert into battle_rooms(host,title,capacity,password_hash,settings) values(p_actor,r.title,r.capacity,r.password_hash,r.settings) returning * into r;
   update battle_rooms set next_room=r.id where id=u;
   insert into battle_room_members(room_id,user_id,seat,person) values(r.id,p_actor,0,battle_person(p_actor));
   return battle_room_view(r.id,p_actor);
  end if;
 end if;
 if r.status='waiting' then
  if not exists(select 1 from battle_room_members where room_id=r.id) then r.status:='closed';
  elsif not exists(select 1 from battle_room_members where room_id=r.id and user_id=r.host) then select user_id into r.host from battle_room_members where room_id=r.id order by joined_at,user_id limit 1;end if;
 end if;
 if r.status='playing' then
  update battle_room_members set left_at=fresh where room_id=r.id and left_at is null and seen_at<fresh-interval '90 seconds';
  if not exists(select 1 from battle_room_members where room_id=r.id and user_id=r.host and left_at is null) then select user_id into u from battle_room_members where room_id=r.id and left_at is null order by joined_at,user_id limit 1;if u is not null then r.host:=u;end if;end if;
  n:=(select count(*) from battle_room_members where room_id=r.id and left_at is null);
  if n<2 then r.status:='finished';r.reason:='참가자가 나가 대전이 종료됐어요.';
  else
   if r.reveal_until is not null and fresh>=r.reveal_until then
    if r.round+1>=jsonb_array_length(r.questions) then r.status:='finished';
    else r.round:=r.round+1;r.round_at:=fresh+interval '1 second';r.reveal_until:=null;end if;
   end if;
   if r.status='playing' and r.reveal_until is null and fresh>=r.round_at then
    q:=r.questions->r.round;key:=r.round::text||':'||p_actor::text;
    if p_action='answer' and me_member.left_at is null and (p_payload->>'round')::integer=r.round and fresh<r.round_at+make_interval(secs=>(r.settings->>'seconds')::integer) and not(r.answers ? key) and exists(select 1 from jsonb_array_elements(q->'options')o where o->>'id'=p_payload->>'choice') then
     r.answers:=r.answers||jsonb_build_object(key,jsonb_build_object('choice',p_payload->>'choice','ms',greatest(0,floor(extract(epoch from(fresh-r.round_at))*1000))));
    end if;
    if fresh>=r.round_at+make_interval(secs=>(r.settings->>'seconds')::integer) or not exists(select 1 from battle_room_members where room_id=r.id and left_at is null and not(r.answers ? (r.round::text||':'||user_id::text))) then
     update battle_room_members set score=score+case when r.answers->(r.round::text||':'||user_id::text)->>'choice'=q->>'correctId' then 1 else 0 end,elapsed_ms=elapsed_ms+case when r.answers->(r.round::text||':'||user_id::text)->>'choice'=q->>'correctId' then (r.answers->(r.round::text||':'||user_id::text)->>'ms')::integer else 0 end where room_id=r.id and left_at is null;
     r.reveal_until:=fresh+interval '2 seconds';
    end if;
   end if;
  end if;
 end if;
 update battle_rooms set host=r.host,status=r.status,questions=r.questions,round=r.round,round_at=r.round_at,reveal_until=r.reveal_until,answers=r.answers,reason=r.reason,updated_at=fresh where id=r.id;
 if r.status='finished' then perform battle_room_settle(r.id);end if;
 if p_action='leave' then return jsonb_build_object('left',true);end if;
 return battle_room_view(r.id,p_actor);
end;$$;
revoke all on function public.battle_room_catalog(uuid),public.battle_room_allowed(uuid,jsonb),public.battle_room_settle(uuid),public.battle_room_view(uuid,uuid),public.battle_room_play(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.battle_room_catalog(uuid),public.battle_room_allowed(uuid,jsonb),public.battle_room_settle(uuid),public.battle_room_view(uuid,uuid),public.battle_room_play(uuid,text,uuid,jsonb) to service_role;
-- Keep older clients from opening a 1:1 invite while either player is in a room.
alter function public.battle_play(uuid,text,uuid,jsonb) rename to battle_play_before_rooms;
create function public.battle_play(p_actor uuid,p_action text,p_id uuid default null,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare t uuid;
begin
 if p_action='invite' then
  t:=(p_payload->>'target')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(least(p_actor,t)::text,91));
  perform pg_advisory_xact_lock(hashtextextended(greatest(p_actor,t)::text,91));
  if exists(select 1 from battle_room_members m join battle_rooms r on r.id=m.room_id where m.user_id in(p_actor,t) and m.left_at is null and r.status in('waiting','playing') and r.updated_at>clock_timestamp()-interval '3 minutes') then raise exception '참가 중인 대전방을 먼저 나와주세요.';end if;
 end if;
 return battle_play_before_rooms(p_actor,p_action,p_id,p_payload);
end;$$;
revoke all on function public.battle_play(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.battle_play(uuid,text,uuid,jsonb) to service_role;
