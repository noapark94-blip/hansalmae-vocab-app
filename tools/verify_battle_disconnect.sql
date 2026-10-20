-- Wrap in BEGIN/ROLLBACK; fixture rooms and any reward writes must not persist.
do $test$
declare ids uuid[];rid uuid;n integer;i integer;v jsonb;t text;setid uuid;q jsonb:='{"word":"test","meaning":"시험","prompt":"test","mode":"engToKor","options":[{"id":"a","text":"시험"},{"id":"b","text":"다른 뜻"}],"correctId":"a"}';
begin
 select array_agg(id) into ids from(select id from profiles where role='student' and enabled order by id limit 8)s;
 if array_length(ids,1)<>8 then raise exception 'Need eight fixture actors';end if;
 select id into setid from word_sets where enabled limit 1;
 foreach n in array array[3,8] loop
  rid:=gen_random_uuid();
  insert into battle_rooms(id,host,title,capacity,settings,status,questions,sync_enabled,prepare_at,round) values(rid,ids[n],'disconnect rollback fixture',n,jsonb_build_object('seconds',10,'count',10,'kind','standard','source',setid,'mode','engToKor','start',1,'end',1),'playing',(select jsonb_agg(q) from generate_series(1,10)),true,clock_timestamp()-interval '7 seconds',1);
  for i in 1..n loop insert into battle_room_members(room_id,user_id,seat,person,ready_round,seen_at) values(rid,ids[i],i-1,jsonb_build_object('name','fixture'),case when i=n then -1 else 1 end,clock_timestamp()-case when i=n then interval '8 seconds' else interval '0 seconds' end);end loop;
  v:=battle_room_play(ids[1],'poll',rid,'{}');
  if v->>'status'<>'playing' or v->'roundAt'='null'::jsonb then raise exception '% players stopped for missing peer',n;end if;
  if v->>'host'=ids[n]::text then raise exception 'Offline host not transferred';end if;
  if (select left_at is not null from battle_room_members where room_id=rid and user_id=ids[n]) then raise exception 'Grace seat lost';end if;
  -- Returning within 30 seconds joins the same current round without a reset.
  update battle_rooms set round_at=clock_timestamp()-interval '1 second' where id=rid;
  v:=battle_room_play(ids[n],'poll',rid,'{}');
  if v->>'round'<>'1' or v->'question'='null'::jsonb then raise exception 'Reconnect did not return current question';end if;
  perform battle_room_play(ids[n],'answer',rid,'{"round":0,"choice":"a"}');
  if (select answers ? ('0:'||ids[n]) from battle_rooms where id=rid) then raise exception 'Backdated answer accepted';end if;
  perform battle_room_play(ids[n],'answer',rid,'{"round":1,"choice":"a"}');
  if not(select answers ? ('1:'||ids[n]) from battle_rooms where id=rid) then raise exception 'Reconnected answer rejected';end if;
  -- An expired heartbeat cannot revive itself through a poll.
  update battle_room_members set seen_at=clock_timestamp()-interval '31 seconds' where room_id=rid and user_id=ids[n];
  v:=battle_room_play(ids[n],'poll',rid,'{}');
  if not(select left_at is not null and connection_lost from battle_room_members where room_id=rid and user_id=ids[n]) then raise exception 'Expired actor revived';end if;
  if v->>'status'<>'playing' then raise exception 'Remaining players stopped';end if;
  -- Finish normally with remaining members: settlement is idempotent and the dropout gets zero.
  update battle_rooms set round=9,reveal_until=clock_timestamp()-interval '1 second' where id=rid;
  update battle_room_members set seen_at=clock_timestamp() where room_id=rid and left_at is null;
  v:=battle_room_play(ids[1],'poll',rid,'{}');
  if v->>'status'<>'finished' or v->'reason'<>'null'::jsonb then raise exception 'Survivors did not finish normally';end if;
  if (select eligible_count from battle_room_rewards where room_id=rid and user_id=ids[n])<>0 then raise exception 'Dropout rewarded';end if;
  if exists(select 1 from battle_room_members where room_id=rid and left_at is null and not completed) then raise exception 'Survivor completion missing';end if;
  perform battle_room_play(ids[1],'poll',rid,'{}');
  if (select count(*) from battle_room_rewards where room_id=rid)<>n then raise exception 'Duplicate settlement';end if;
 end loop;
 -- Solo choice: no immediate forced end, no early or forged choice, no practice points.
 rid:=gen_random_uuid();
 insert into battle_rooms(id,host,title,capacity,settings,status,questions,sync_enabled,prepare_at,round) values(rid,ids[1],'solo rollback fixture',2,jsonb_build_object('seconds',10,'count',10,'kind','standard','source',setid),'playing',(select jsonb_agg(q) from generate_series(1,10)),true,clock_timestamp()-interval '6 seconds',1);
 insert into battle_room_members(room_id,user_id,seat,person,ready_round,seen_at,score) values(rid,ids[1],0,'{}',1,clock_timestamp(),1),(rid,ids[2],1,'{}',-1,clock_timestamp()-interval '8 seconds',0);
 v:=battle_room_play(ids[1],'poll',rid,'{}');
 if v->>'status'<>'playing' or v->'soloWaitUntil'='null'::jsonb or (v->>'canChooseSolo')::boolean then raise exception 'Solo grace missing';end if;
 begin perform battle_room_play(ids[1],'continuesolo',rid,'{}');raise exception 'Early choice accepted';exception when others then if sqlerrm='Early choice accepted' then raise;end if;end;
 -- Reconnection releases the pause and retains shared clock.
 v:=battle_room_play(ids[2],'poll',rid,'{}');t:=v->>'syncToken';
 v:=battle_room_play(ids[2],'poll',rid,jsonb_build_object('readyRound',1,'syncToken',t));
 if v->'roundAt'='null'::jsonb or v->'soloWaitUntil'<>'null'::jsonb then raise exception 'Reconnection failed to release pause';end if;
 update battle_rooms set round_at=null,solo_wait_at=clock_timestamp()-interval '31 seconds' where id=rid;
 update battle_room_members set seen_at=clock_timestamp()-interval '31 seconds' where room_id=rid and user_id=ids[2];
 v:=battle_room_play(ids[1],'poll',rid,'{}');if not(v->>'canChooseSolo')::boolean then raise exception 'Solo actions absent';end if;
 begin
  v:=battle_room_play(ids[1],'endsolo',rid,'{}');
  if v->>'status'<>'finished' or (v->'reward'->>'xp')::integer<>0 then raise exception 'End solo failed';end if;
  raise exception 'rollback end-solo fixture';
 exception when others then if sqlerrm<>'rollback end-solo fixture' then raise;end if;end;
 v:=battle_room_play(ids[1],'continuesolo',rid,'{}');if not(v->>'soloMode')::boolean or v->'roundAt'='null'::jsonb then raise exception 'Solo practice did not start';end if;
 update battle_rooms set round_at=clock_timestamp()-interval '1 second' where id=rid;
 v:=battle_room_play(ids[1],'answer',rid,'{"round":1,"choice":"a"}');
 if (select score from battle_room_members where room_id=rid and user_id=ids[1])<>1 then raise exception 'Practice increased score';end if;
 update battle_rooms set round=9,reveal_until=clock_timestamp()-interval '1 second' where id=rid;
 v:=battle_room_play(ids[1],'poll',rid,'{}');
 if v->>'status'<>'finished' or exists(select 1 from battle_room_rewards where room_id=rid and (points<>0 or xp<>0 or eligible_count<>0)) then raise exception 'Solo rewards granted';end if;
 if exists(select 1 from battle_room_members where room_id=rid and completed) then raise exception 'Practice counted for emblem';end if;
 -- All missing closes without awards; a read from an expired actor cannot keep game alive.
 rid:=gen_random_uuid();
 insert into battle_rooms(id,host,title,capacity,settings,status,questions,sync_enabled,prepare_at) values(rid,ids[1],'empty rollback fixture',2,'{"seconds":10,"count":10}','playing',jsonb_build_array(q),true,clock_timestamp());
 insert into battle_room_members(room_id,user_id,seat,person,seen_at) values(rid,ids[1],0,'{}',clock_timestamp()-interval '31 seconds'),(rid,ids[2],1,'{}',clock_timestamp()-interval '31 seconds');
 v:=battle_room_play(ids[1],'poll',rid,'{}');if v->>'status'<>'closed' then raise exception 'Empty room stayed open';end if;
 if has_function_privilege('authenticated','public.battle_room_play(uuid,text,uuid,jsonb)','execute') or has_table_privilege('anon','public.battle_room_members','select') then raise exception 'Private state exposed';end if;
end;$test$;
select 'PASS 3/8-player continuation, host handoff, same-round reconnect, stale answer rejection, expiry, solo grace/rejoin/practice, no solo rewards, completion, idempotency, empty room, permissions' as result;
