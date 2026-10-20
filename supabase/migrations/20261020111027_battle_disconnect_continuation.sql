-- One missing player must not close a multiplayer match.
-- Server clocks and row locks remain authoritative; only service_role can call these RPCs.
alter table public.battle_rooms add column solo_mode boolean not null default false, add column solo_wait_at timestamptz;
alter table public.battle_room_members add column connection_lost boolean not null default false;
CREATE OR REPLACE FUNCTION public.battle_room_play(p_actor uuid, p_action text, p_id uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r battle_rooms;me_member battle_room_members;fresh timestamptz:=clock_timestamp();n integer;connected integer;seat_no integer;q jsonb;key text;content text;kind text;last_sent timestamptz;u uuid;
begin
 if not exists(select 1 from profiles where id=p_actor and enabled and role='student') then raise exception '학생 로그인이 필요합니다.';end if;
 -- Consistent actor lock for joining/creating, room row lock for all gameplay mutations.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,91));
 if p_action in('lobby','create','join') then
  update battle_rooms set status='closed',reason='오래 비어 있던 방이 정리됐어요.' where status in('waiting','playing') and updated_at<fresh-interval '3 minutes';
 end if;
 if p_action='lobby' then
  return jsonb_build_object('me',battle_person(p_actor),'rooms',coalesce((select jsonb_agg(v order by joined desc,waiting desc,created desc) from(
   select listed_room.created_at created,listed_room.status='waiting' waiting,exists(select 1 from battle_room_members where room_id=listed_room.id and user_id=p_actor and left_at is null) joined,
    jsonb_build_object('id',listed_room.id,'title',listed_room.title,'host',battle_person(listed_room.host),'capacity',listed_room.capacity,'status',listed_room.status,'locked',listed_room.password_hash is not null,'settings',listed_room.settings,'joined',exists(select 1 from battle_room_members where room_id=listed_room.id and user_id=p_actor and left_at is null),'members',(select coalesce(jsonb_agg(person order by seat),'[]') from battle_room_members where room_id=listed_room.id and left_at is null)) v
   from battle_rooms listed_room where listed_room.status in('waiting','playing') and battle_room_allowed(p_actor,listed_room.settings) and not exists(select 1 from battle_room_members m join battle_blocks b on (b.actor=p_actor and b.target=m.user_id) or(b.target=p_actor and b.actor=m.user_id) where m.room_id=listed_room.id and m.left_at is null) order by listed_room.created_at desc limit 60
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
 fresh:=clock_timestamp();
 if r.id is null then raise exception '방이 종료되었거나 없어졌어요.';end if;
 -- Expire missing participants before refreshing the caller's heartbeat.
 if r.status='playing' then
  update battle_room_members set left_at=fresh,connection_lost=true where room_id=r.id and left_at is null and seen_at<fresh-interval '30 seconds';
 end if;
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
  if p_payload->>'protocol'='2' then update battle_room_members set sync_capable=true where room_id=r.id and user_id=p_actor;end if;
  if r.sync_enabled and r.status='playing' and r.round_at is null and me_member.left_at is null and p_payload->>'readyRound'=r.round::text and p_payload->>'syncToken'=me_member.sync_token::text and me_member.sync_sent_at is not null then
   update battle_room_members set ready_round=r.round,latency_ms=least(coalesce(latency_ms,200),200,greatest(0,floor(extract(epoch from(fresh-sync_sent_at))*500)::integer)),sync_token=null where room_id=r.id and user_id=p_actor;
  end if;
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
    if exists(select 1 from battle_room_members where room_id=r.id and not sync_capable) then raise exception '모두 앱을 새로고침한 뒤 준비해주세요.';end if;
    r.questions:=p_payload->'questions';r.status:='playing';r.round:=0;r.round_at:=null;r.sync_enabled:=true;r.prepare_at:=fresh;
    update battle_room_members set ready_round=-1,sync_token=null,sync_sent_at=null,latency_ms=null where room_id=r.id;
    update battle_room_members set person=battle_person(user_id) where room_id=r.id;
   end if;
  elsif p_action='chat' then
   content:=btrim(coalesce(p_payload->>'body',''));kind:=p_payload->>'kind';
   if r.status not in('waiting','playing','finished') or (kind='text' and r.status='playing') then raise exception '경기 중에는 이모티콘만 보낼 수 있어요.';end if;
   if kind not in('text','emoji') or char_length(content) not between 1 and 160 then raise exception '메시지는 1~160자로 입력해주세요.';end if;
   if kind='emoji' and content not in('👋','😂','🔥','👍','😭','👏','💗','😄','😛') then raise exception '이모티콘을 다시 선택해주세요.';end if;
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
  if not exists(select 1 from battle_room_members where room_id=r.id and user_id=r.host and left_at is null and seen_at>=fresh-interval '6 seconds') then
   select user_id into u from battle_room_members where room_id=r.id and left_at is null and seen_at>=fresh-interval '6 seconds' order by joined_at,user_id limit 1;
   if u is not null then r.host:=u;end if;
  end if;
  n:=(select count(*) from battle_room_members where room_id=r.id and left_at is null);
  if n=0 then r.status:='closed';r.reason:='모든 참가자의 연결이 종료됐어요.';
  else
   if r.reveal_until is not null and fresh>=r.reveal_until then
    if r.round+1>=jsonb_array_length(r.questions) then r.status:='finished';
    else r.round:=r.round+1;r.round_at:=case when r.sync_enabled then null else fresh+interval '1 second' end;r.reveal_until:=null;r.prepare_at:=fresh;
     update battle_room_members set sync_token=null,sync_sent_at=null where room_id=r.id;
    end if;
   end if;
   if r.status='playing' and r.sync_enabled and r.round_at is null then
    select count(*) into connected from battle_room_members where room_id=r.id and left_at is null and seen_at>=fresh-interval '6 seconds' and ready_round=r.round;
    if connected>=2 or (r.solo_mode and connected>=1) then
     r.solo_wait_at:=null;
     if not exists(select 1 from battle_room_members where room_id=r.id and left_at is null and seen_at>=fresh-interval '6 seconds' and ready_round<>r.round)
        or fresh>=r.prepare_at+interval '5 seconds' then
      r.round_at:=fresh+case when r.round=0 then interval '4 seconds' else interval '2 seconds' end;
     end if;
    else
     r.solo_wait_at:=coalesce(r.solo_wait_at,(select max(seen_at) from battle_room_members where room_id=r.id and user_id<>p_actor and left_at is null),fresh);
     if p_action in('continuesolo','endsolo') then
      if me_member.left_at is not null or connected<>1 or me_member.ready_round<>r.round or fresh<r.solo_wait_at+interval '30 seconds' then
       raise exception '친구의 재접속을 기다리고 있어요.';
      end if;
      r.reason:='혼자 남아 연습으로 마무리한 대전이에요. 보상은 지급되지 않아요.';
      r.solo_mode:=true;r.solo_wait_at:=null;
      if p_action='endsolo' then r.status:='finished';
      else r.round_at:=fresh+interval '2 seconds';end if;
     end if;
    end if;
   end if;
   if r.status='playing' and r.reveal_until is null and fresh>=r.round_at then
    q:=r.questions->r.round;key:=r.round::text||':'||p_actor::text;
    if p_action='answer' and me_member.left_at is null and (p_payload->>'round')::integer=r.round and fresh<r.round_at+make_interval(secs=>(r.settings->>'seconds')::integer)+(case when r.sync_enabled then coalesce(me_member.latency_ms,0)*interval '1 millisecond' else interval '0' end) and not(r.answers ? key) and exists(select 1 from jsonb_array_elements(q->'options')o where o->>'id'=p_payload->>'choice') then
     r.answers:=r.answers||jsonb_build_object(key,jsonb_build_object('choice',p_payload->>'choice','ms',greatest(0,floor(extract(epoch from(fresh-r.round_at))*1000)-case when r.sync_enabled then coalesce(me_member.latency_ms,0) else 0 end)));
    end if;
    if fresh>=r.round_at+make_interval(secs=>(r.settings->>'seconds')::integer)+(case when r.sync_enabled then interval '200 milliseconds' else interval '0' end) or not exists(select 1 from battle_room_members where room_id=r.id and left_at is null and not(r.answers ? (r.round::text||':'||user_id::text))) then
     update battle_room_members set score=score+case when not r.solo_mode and r.answers->(r.round::text||':'||user_id::text)->>'choice'=q->>'correctId' then 1 else 0 end,elapsed_ms=elapsed_ms+case when not r.solo_mode and r.answers->(r.round::text||':'||user_id::text)->>'choice'=q->>'correctId' then (r.answers->(r.round::text||':'||user_id::text)->>'ms')::integer else 0 end where room_id=r.id and left_at is null;
     r.reveal_until:=fresh+interval '2 seconds';
    end if;
   end if;
  end if;
 end if;
 if r.status='finished' then
  update battle_room_members set left_at=fresh,connection_lost=true where room_id=r.id and left_at is null and seen_at<fresh-interval '6 seconds';
 end if;
 update battle_rooms set solo_mode=r.solo_mode,solo_wait_at=r.solo_wait_at,sync_enabled=r.sync_enabled,prepare_at=r.prepare_at,host=r.host,status=r.status,questions=r.questions,round=r.round,round_at=r.round_at,reveal_until=r.reveal_until,answers=r.answers,reason=r.reason,updated_at=fresh where id=r.id;
 if r.status='finished' then perform battle_room_settle(r.id);end if;
 if p_action='leave' then return jsonb_build_object('left',true);end if;
 if r.sync_enabled and r.status='playing' and r.round_at is null then
  update battle_room_members set sync_token=gen_random_uuid(),sync_sent_at=clock_timestamp() where room_id=r.id and user_id=p_actor and left_at is null and ready_round<>r.round and sync_token is null;
 end if;
 return battle_room_view(r.id,p_actor);
end;$function$

;
CREATE OR REPLACE FUNCTION public.battle_room_view(p_room uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r battle_rooms;q jsonb;review jsonb;fresh timestamptz:=clock_timestamp();
begin
 select * into r from battle_rooms where id=p_room;
 if not exists(select 1 from battle_room_members where room_id=r.id and user_id=p_actor) then raise exception '참가한 방만 볼 수 있어요.';end if;
 q:=r.questions->r.round;
 if r.status='finished' then
  select jsonb_agg(jsonb_build_object('word',v->>'word','meaning',v->>'meaning','example',v->>'example','translation',v->>'translation','correct',coalesce(r.answers->((i-1)::text||':'||p_actor::text)->>'choice'=v->>'correctId',false)) order by i) into review from jsonb_array_elements(r.questions) with ordinality t(v,i);
 end if;
 return jsonb_build_object('id',r.id,'title',r.title,'capacity',r.capacity,'host',r.host,'me',p_actor,'status',r.status,'settings',r.settings,'reason',r.reason,'nextRoom',r.next_room,'serverNow',fresh,'round',r.round,'roundAt',r.round_at,'deadline',r.round_at+make_interval(secs=>(r.settings->>'seconds')::integer),'revealUntil',r.reveal_until,
 'prepareDeadline',r.prepare_at+interval '5 seconds','soloMode',r.solo_mode,'soloWaitUntil',case when r.solo_wait_at is not null then r.solo_wait_at+interval '30 seconds' end,'canChooseSolo',r.solo_wait_at is not null and fresh>=r.solo_wait_at+interval '30 seconds' and exists(select 1 from battle_room_members where room_id=r.id and user_id=p_actor and left_at is null and ready_round=r.round),'syncEnabled',r.sync_enabled,'preparing',r.sync_enabled and r.status='playing' and r.round_at is null,
 'syncToken',(select sync_token from battle_room_members where room_id=r.id and user_id=p_actor),
 'preparedQuestion',case when r.sync_enabled and r.status='playing' and r.reveal_until is null then jsonb_build_object('prompt',q->>'prompt','mode',q->>'mode','options',(select jsonb_agg(value order by md5(value->>'id'||p_actor::text)) from jsonb_array_elements(q->'options')),'correctId',null) else null end,
 'members',coalesce((select jsonb_agg(person||jsonb_build_object('id',user_id,'seat',seat,'ready',ready,'score',score,'ms',elapsed_ms,'rankMs',case when r.sync_enabled then (elapsed_ms/500)*500 else elapsed_ms end,'loaded',ready_round=r.round,'left',left_at is not null,'connectionLost',connection_lost,'reconnectUntil',seen_at+interval '30 seconds','online',seen_at>=fresh-interval '6 seconds','answered',r.answers ? (r.round::text||':'||user_id::text)) order by seat) from battle_room_members where room_id=r.id),'[]'),
 'question',case when r.status='playing' and fresh>=r.round_at then jsonb_build_object('prompt',q->>'prompt','mode',q->>'mode','options',(select jsonb_agg(value order by md5(value->>'id'||p_actor::text)) from jsonb_array_elements(q->'options')),'correctId',case when r.reveal_until is not null then q->>'correctId' else null end) else null end,
 'answered',r.answers ? (r.round::text||':'||p_actor::text),'choice',r.answers->(r.round::text||':'||p_actor::text)->>'choice','review',review,
 'chat',coalesce((select jsonb_agg(to_jsonb(msg) order by id) from(select id,sender,kind,body,created_at at from battle_room_messages where room_id=r.id order by id desc limit 40)msg),'[]'),
 'reward',(select jsonb_build_object('points',points,'xp',xp,'eligibleCount',eligible_count) from battle_room_rewards where room_id=r.id and user_id=p_actor));
end;$function$

;
