-- Execute inside a rollback transaction; no real gameplay or reward records persist.
do $test$
declare ids uuid[];rid uuid;setid uuid;v jsonb;reward_before jsonb;q jsonb:='{"word":"test","meaning":"시험","prompt":"test","mode":"engToKor","options":[{"id":"a","text":"시험"}],"correctId":"a"}';
begin
 select array_agg(id) into ids from(select id from profiles where role='student' and enabled order by id limit 3)s;
 select id into setid from word_sets where enabled limit 1;
 rid:=gen_random_uuid();
 insert into battle_rooms(id,host,title,capacity,settings,status,questions,sync_enabled,round,round_at,reveal_until) values(rid,ids[1],'final grace rollback fixture',3,jsonb_build_object('seconds',10,'count',10,'kind','standard','source',setid,'mode','engToKor','start',1,'end',1),'playing',(select jsonb_agg(q) from generate_series(1,10)),true,9,clock_timestamp()-interval '11 seconds',clock_timestamp()-interval '1 second');
 insert into battle_room_members(room_id,user_id,seat,person,seen_at) values(rid,ids[1],0,'{}',clock_timestamp()),(rid,ids[2],1,'{}',clock_timestamp()-interval '8 seconds'),(rid,ids[3],2,'{}',clock_timestamp());
 v:=battle_room_play(ids[1],'poll',rid,'{}');
 if v->>'status'<>'playing' or not(v->>'finalizing')::boolean then raise exception 'Final round ended before reconnect grace';end if;
 if exists(select 1 from battle_room_rewards where room_id=rid) then raise exception 'Settlement happened during grace';end if;
 v:=battle_room_play(ids[2],'poll',rid,'{}');
 if v->>'status'<>'finished' or exists(select 1 from battle_room_members where room_id=rid and (left_at is not null or not completed)) then raise exception 'Final rejoin lost completion';end if;
 select jsonb_agg(to_jsonb(x) order by user_id) into reward_before from battle_room_rewards x where room_id=rid;
 -- Staying on results, or exiting them, must not alter the final roster or rewards.
 update battle_room_members set seen_at=clock_timestamp()-interval '60 seconds' where room_id=rid and user_id<>ids[1];
 perform battle_room_play(ids[1],'poll',rid,'{}');
 perform battle_room_play(ids[2],'leave',rid,'{}');
 if exists(select 1 from battle_room_members where room_id=rid and (left_at is not null or connection_lost or not completed)) then raise exception 'Settled roster changed';end if;
 if reward_before is distinct from (select jsonb_agg(to_jsonb(x) order by user_id) from battle_room_rewards x where room_id=rid) then raise exception 'Settled reward changed';end if;
 -- A different room with a peer that does not return eventually settles normally.
 rid:=gen_random_uuid();
 insert into battle_rooms(id,host,title,capacity,settings,status,questions,sync_enabled,round,round_at,reveal_until) values(rid,ids[1],'final timeout rollback fixture',3,jsonb_build_object('seconds',10,'count',10,'kind','standard','source',setid,'mode','engToKor','start',1,'end',1),'playing',(select jsonb_agg(q) from generate_series(1,10)),true,9,clock_timestamp()-interval '11 seconds',clock_timestamp()-interval '1 second');
 insert into battle_room_members(room_id,user_id,seat,person,seen_at) values(rid,ids[1],0,'{}',clock_timestamp()),(rid,ids[2],1,'{}',clock_timestamp()-interval '31 seconds'),(rid,ids[3],2,'{}',clock_timestamp());
 v:=battle_room_play(ids[1],'poll',rid,'{}');
 if v->>'status'<>'finished' then raise exception 'Final dropout blocked survivors';end if;
 if not(select left_at is not null and connection_lost and not completed from battle_room_members where room_id=rid and user_id=ids[2]) then raise exception 'Expired participant got completion';end if;
 if (select eligible_count from battle_room_rewards where room_id=rid and user_id=ids[2])<>0 then raise exception 'Expired participant got rewards';end if;
end;$test$;
select 'PASS final-round grace/rejoin/expiry, immutable result roster and rewards, result-screen exit' as result;
