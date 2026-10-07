begin;
set local statement_timeout='15s';
set local lock_timeout='2s';
do $test$
declare users uuid[];r uuid;counts integer[]:=array[2,3,8];i integer;j integer;u uuid;b uuid;
begin
 select array_agg(gen_random_uuid()) into users from generate_series(1,8);
 for i in 1..8 loop
  insert into auth.users(id) values(users[i]);
  insert into profiles(id,student_id,display_name) values(users[i],'__chick_test_'||i,'쌈닭 검증');
 end loop;
 assert battle_completed_count(users[1])=0;
 for i in 1..3 loop
  insert into battle_rooms(host,title,capacity,settings,questions,status,round,reveal_until)
   values(users[1],'완료 검증',counts[i],'{}','[{}]','playing',0,clock_timestamp()) returning id into r;
  for j in 1..counts[i] loop
   insert into battle_room_members(room_id,user_id,seat,person) values(r,users[j],j-1,'{}');
  end loop;
  if i=3 then update battle_room_members set left_at=clock_timestamp() where room_id=r and user_id=users[8];end if;
  update battle_rooms set status='finished' where id=r;
  assert battle_completed_count(users[1])=i,'2/3/8 player normal completions';
  update battle_room_members set left_at=clock_timestamp() where room_id=r and user_id=users[1];
  update battle_rooms set status='finished' where id=r;
  assert battle_completed_count(users[1])=i,'result departure and repeated polling preserve count';
 end loop;
 assert battle_completed_count(users[8])=0,'mid-game leaver excluded';
 assert battle_completed_count(users[7])=1,'win/loss irrelevant';
 for i in 1..2 loop
  insert into battle_rooms(host,title,capacity,settings,questions,status,round,reveal_until)
   values(users[1],'중단 검증',2,'{}','[{}]','playing',0,clock_timestamp()) returning id into r;
  insert into battle_room_members(room_id,user_id,seat,person) values(r,users[1],0,'{}');
  update battle_rooms set status=case when i=1 then 'closed' else 'finished' end,reason='중도 종료' where id=r;
 end loop;
 assert battle_completed_count(users[1])=3,'aborted games excluded';
 insert into word_battles(host,guest,status,settings,questions,round,reveal_until,rewards_enabled)
 values(users[1],users[2],'playing','{}',(select jsonb_agg('{}'::jsonb) from generate_series(1,10)),9,clock_timestamp(),false) returning id into b;
 update word_battles set status='finished' where id=b;
 assert battle_completed_count(users[1])=4,'legacy complete game included';
 update word_battles set reason='퇴장' where id=b;
 assert battle_completed_count(users[1])=3,'legacy forfeit excluded';
 assert not has_function_privilege('anon','battle_completed_count(uuid)','execute');
 assert not has_function_privilege('authenticated','battle_completed_count(uuid)','execute');
 assert (select condition_value from emblem_settings where id='achievement_battle_chick')='3'::jsonb;
end $test$;
select 'PASS participation: 2/3/8 players, third completion, no duplicate, result exit, midgame exit, abort, legacy, service-only access' as verification;
rollback;
