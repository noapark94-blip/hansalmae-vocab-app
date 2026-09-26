-- Run with the room migration in a rolled-back transaction.
do $$
declare users uuid[];u uuid;r jsonb;rid uuid;qs jsonb;i integer;j integer;oldhost uuid;setid uuid;
begin
 select array_agg(gen_random_uuid()) into users from generate_series(1,10);
 for i in 1..10 loop
  insert into auth.users(id) values(users[i]);
  insert into profiles(id,student_id,display_name) values(users[i],'__room_test_'||i,'검증 '||i);
 end loop;
 select id into setid from word_sets where enabled limit 1;
 select jsonb_agg(jsonb_build_object('prompt','test'||n,'word','test'||n,'meaning','뜻'||n,'mode','engToKor','correctId','yes'||n,'options',jsonb_build_array(jsonb_build_object('id','yes'||n,'text','정답'),jsonb_build_object('id','no'||n,'text','오답')))) into qs from generate_series(0,9)n;
 r:=battle_room_play(users[1],'create',null,jsonb_build_object('title','검증방','capacity',8,'password','1234','settings',jsonb_build_object('kind','standard','source',setid,'title','검증','start',1,'end',1,'count',10,'seconds',10,'mode','engToKor')));rid:=(r->>'id')::uuid;
 assert jsonb_array_length(r->'members')=1;
 assert r->'question'='null'::jsonb;
 r:=battle_room_play(users[2],'join',rid,'{"password":"wrong"}');assert r ? 'error','password';
 assert not exists(select 1 from battle_room_members where room_id=rid and user_id=users[2]);
 for i in 2..8 loop r:=battle_room_play(users[i],'join',rid,'{"password":"1234"}');end loop;
 assert jsonb_array_length(r->'members')=8,'8 members';
 begin perform battle_room_play(users[9],'join',rid,'{"password":"1234"}');raise exception 'FAIL capacity';exception when others then if SQLERRM='FAIL capacity' then raise;end if;end;
 begin perform battle_room_play(users[9],'poll',rid);raise exception 'FAIL outsider';exception when others then if SQLERRM='FAIL outsider' then raise;end if;end;
 begin perform battle_room_play(users[2],'start',rid,jsonb_build_object('questions',qs));raise exception 'FAIL host';exception when others then if SQLERRM='FAIL host' then raise;end if;end;
 begin perform battle_room_play(users[1],'start',rid,jsonb_build_object('questions',qs));raise exception 'FAIL ready';exception when others then if SQLERRM='FAIL ready' then raise;end if;end;
 perform battle_room_play(users[1],'chat',rid,'{"kind":"text","body":"안녕하세요"}');
 r:=battle_room_play(users[2],'poll',rid);assert jsonb_array_length(r->'chat')=1;
 begin perform battle_room_play(users[1],'chat',rid,'{"kind":"emoji","body":"🔥"}');raise exception 'FAIL spam';exception when others then if SQLERRM='FAIL spam' then raise;end if;end;
 for i in 1..8 loop perform battle_room_play(users[i],'ready',rid,'{"ready":true}');end loop;
 r:=battle_room_play(users[1],'start',rid,jsonb_build_object('questions',qs));assert r->>'status'='playing';assert r->'question'='null'::jsonb,'countdown leak';
 r:=battle_room_play(users[1],'answer',rid,'{"round":0,"choice":"yes0"}');assert not (r->>'answered')::boolean,'early answer';
 begin perform battle_room_play(users[2],'chat',rid,'{"kind":"text","body":"answer"}');raise exception 'FAIL live text';exception when others then if SQLERRM='FAIL live text' then raise;end if;end;
 for j in 0..9 loop
  update battle_rooms set round_at=clock_timestamp()-interval '1 second' where id=rid;
  for i in 1..8 loop
   r:=battle_room_play(users[i],'answer',rid,jsonb_build_object('round',j,'choice','yes'||j));
   if i<8 then assert r->'question'->'correctId'='null'::jsonb,'answer leak';end if;
  end loop;
  assert r->'question'->>'correctId'='yes'||j;
  r:=battle_room_play(users[1],'answer',rid,jsonb_build_object('round',j,'choice','no'||j));assert r->>'choice'='yes'||j,'answer overwrite';
  update battle_rooms set reveal_until=clock_timestamp()-interval '1 second' where id=rid;
  r:=battle_room_play(users[1],'poll',rid);
 end loop;
 assert r->>'status'='finished';assert jsonb_array_length(r->'review')=10;
 assert (r->'members'->0->>'score')::int=10;
 assert (select count(*) from battle_room_rewards where room_id=rid)=8;
 perform battle_room_play(users[1],'poll',rid);assert (select count(*) from battle_room_rewards where room_id=rid)=8,'idempotent rewards';
 assert (battle_reward_allowance(users[1])->>'remaining')::integer=90,'shared cap';
 update battle_room_messages set created_at=clock_timestamp()-interval '4 seconds' where room_id=rid;
 perform battle_room_play(users[1],'chat',rid,'{"kind":"text","body":"수고했어요"}');
 r:=battle_room_play(users[1],'rematch',rid);oldhost:=rid;rid:=(r->>'id')::uuid;
 r:=battle_room_play(users[2],'poll',oldhost);assert r->>'nextRoom'=rid::text;
 r:=battle_room_play(users[2],'join',rid);assert jsonb_array_length(r->'members')=2,'rematch join without password';
 perform battle_room_play(users[1],'leave',rid);r:=battle_room_play(users[2],'poll',rid);assert r->>'host'=users[2]::text,'host succession';assert jsonb_array_length(r->'members')=1;
 perform battle_room_play(users[2],'leave',rid);assert (select status from battle_rooms where id=rid)='closed','empty room cleanup';
 assert not has_table_privilege('authenticated','battle_rooms','SELECT');assert not has_function_privilege('anon','battle_room_play(uuid,text,uuid,jsonb)','EXECUTE');
end;$$;
