-- Keep the lobby table alias distinct from the PL/pgSQL room record.
create or replace function public.battle_room_play(p_actor uuid,p_action text,p_id uuid default null,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
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
