-- Run in a transaction with the synchronization migration; all fixture changes roll back.
do $test$
declare a uuid;b uuid;rid uuid:=gen_random_uuid();v jsonb;w jsonb;t text;setid uuid;q jsonb:='{"prompt":"test","mode":"engToKor","options":[{"id":"a","text":"one"},{"id":"b","text":"two"}],"correctId":"a"}';
begin
 select id into a from profiles where role='student' and enabled order by id limit 1;
 select id into b from profiles where role='student' and enabled and id<>a order by id limit 1;
 if b is null then raise exception 'Two fixture actors are required';end if;
 select id into setid from word_sets where enabled limit 1;
 insert into battle_rooms(id,host,title,capacity,settings,status,questions,sync_enabled,prepare_at) values(rid,a,'sync rollback fixture',2,jsonb_build_object('seconds',10,'count',10,'kind','standard','source',setid), 'waiting',(select jsonb_agg(q) from generate_series(1,10)),true,clock_timestamp());
 insert into battle_room_members(room_id,user_id,seat,person) values(rid,a,0,'{}'),(rid,b,1,'{}');
 perform battle_room_play(a,'ready',rid,'{"protocol":2,"ready":true}');
 perform battle_room_play(b,'ready',rid,'{"protocol":2,"ready":true}');
 v:=battle_room_play(a,'start',rid,jsonb_build_object('questions',(select jsonb_agg(q) from generate_series(1,10))));
 if v->>'status'<>'playing' or not (v->>'preparing')::boolean then raise exception 'Start bypassed preparation';end if;
 v:=battle_room_play(a,'poll',rid,'{"protocol":2}');
 if not (v->>'preparing')::boolean or v->'question'<>'null'::jsonb or v->'preparedQuestion'->'correctId'<>'null'::jsonb then raise exception 'Preparation leaked visible question or answer';end if;
 t:=v->>'syncToken';
 perform battle_room_play(a,'poll',rid,jsonb_build_object('readyRound',0,'syncToken','bad'));
 if exists(select 1 from battle_room_members where room_id=rid and ready_round=0) then raise exception 'Forged token acknowledged';end if;
 update battle_room_members set sync_sent_at=clock_timestamp()-interval '100 milliseconds' where room_id=rid and user_id=a;
 v:=battle_room_play(a,'poll',rid,jsonb_build_object('readyRound',0,'syncToken',t));
 if v->'roundAt'<>'null'::jsonb then raise exception 'Started before all ready';end if;
 w:=battle_room_play(b,'poll',rid,'{}');
 v:=battle_room_play(b,'poll',rid,jsonb_build_object('readyRound',0,'syncToken',w->>'syncToken'));
 if (v->>'roundAt')::timestamptz-(v->>'serverNow')::timestamptz not between interval '3.5 seconds' and interval '4 seconds' then raise exception 'First countdown must be four seconds';end if;
 if (v->>'deadline')::timestamptz-(v->>'roundAt')::timestamptz<>interval '10 seconds' then raise exception 'Countdown consumed answer time';end if;
 w:=battle_room_view(rid,a);if v->>'roundAt'<>w->>'roundAt' then raise exception 'Different starts';end if;
 perform battle_room_play(a,'answer',rid,'{"round":0,"choice":"a"}');
 if (select answers<>'{}'::jsonb from battle_rooms where id=rid) then raise exception 'Early answer accepted';end if;
 -- The whole room keeps the grace window open; each actor only gets its own bounded allowance.
 update battle_rooms set round_at=clock_timestamp()-interval '10 seconds'-interval '40 milliseconds' where id=rid;
 update battle_room_members set latency_ms=100 where room_id=rid and user_id=a;
 v:=battle_room_play(b,'poll',rid,'{}');if v->'revealUntil'<>'null'::jsonb then raise exception 'Poll ended before delivery grace';end if;
 v:=battle_room_play(a,'answer',rid,'{"round":0,"choice":"a"}');if not (v->>'answered')::boolean then raise exception 'In-flight answer rejected';end if;
 perform battle_room_play(a,'answer',rid,'{"round":0,"choice":"b"}');
 if (select answers->('0:'||a)->>'choice' from battle_rooms where id=rid)<>'a' then raise exception 'Duplicate rewrote answer';end if;
 update battle_rooms set round_at=clock_timestamp()-interval '11 seconds' where id=rid;
 v:=battle_room_play(b,'answer',rid,'{"round":0,"choice":"a"}');if (v->>'answered')::boolean then raise exception 'Late answer accepted';end if;
 if (select score from battle_room_members where room_id=rid and user_id=a)<>1 then raise exception 'Score incorrect';end if;
 update battle_rooms set reveal_until=clock_timestamp()-interval '1 second' where id=rid;
 v:=battle_room_play(a,'poll',rid,'{}');if v->>'round'<>'1' or not (v->>'preparing')::boolean then raise exception 'Next round skipped barrier';end if;
 perform battle_room_play(a,'poll',rid,jsonb_build_object('readyRound',0,'syncToken',t));
 if exists(select 1 from battle_room_members where room_id=rid and ready_round=1) then raise exception 'Stale acknowledgement accepted';end if;
 update battle_rooms set prepare_at=clock_timestamp()-interval '13 seconds' where id=rid;
 v:=battle_room_play(a,'poll',rid,'{}');if v->>'status'<>'closed' then raise exception 'Missing readiness timeout';end if;
 if exists(select 1 from battle_room_rewards where room_id=rid) then raise exception 'Timeout awarded rewards';end if;
end;$test$;
select 'PASS synchronized start, private answer, forged/stale ACK rejection, bounded grace, no duplicates, next-round barrier, timeout without rewards' as result;
do $eight$
declare ids uuid[];rid uuid:=gen_random_uuid();i integer;v jsonb;token text;q jsonb:='{"prompt":"test","options":[{"id":"a","text":"one"}],"correctId":"a"}';start_at text;
begin
 select array_agg(id) into ids from(select id from profiles where role='student' and enabled order by id limit 8)s;
 if array_length(ids,1)<>8 then raise exception 'Need eight fixture actors';end if;
 insert into battle_rooms(id,host,title,capacity,settings,status,questions,sync_enabled,prepare_at) values(rid,ids[1],'eight rollback fixture',8,'{"seconds":10,"count":10}','playing',(select jsonb_agg(q) from generate_series(1,10)),true,clock_timestamp());
 for i in 1..8 loop insert into battle_room_members(room_id,user_id,seat,person) values(rid,ids[i],i-1,'{}');end loop;
 for i in 1..8 loop
  v:=battle_room_play(ids[i],'poll',rid,'{}');token:=v->>'syncToken';
  v:=battle_room_play(ids[i],'poll',rid,jsonb_build_object('readyRound',0,'syncToken',token));
  if i<8 and v->'roundAt'<>'null'::jsonb then raise exception 'Eight-person barrier started at %',i;end if;
 end loop;
 start_at:=v->>'roundAt';if start_at is null then raise exception 'Eight-person barrier failed to release';end if;
 for i in 1..8 loop v:=battle_room_view(rid,ids[i]);if v->>'roundAt'<>start_at then raise exception 'Different eight-person clocks';end if;end loop;
 -- Next question also waits for everyone, but retains the shorter common delay.
 update battle_rooms set round=1,round_at=null,prepare_at=clock_timestamp() where id=rid;
 for i in 1..8 loop
  v:=battle_room_play(ids[i],'poll',rid,'{}');token:=v->>'syncToken';
  v:=battle_room_play(ids[i],'poll',rid,jsonb_build_object('readyRound',1,'syncToken',token));
  if i<8 and v->'roundAt'<>'null'::jsonb then raise exception 'Next round started before everyone was ready';end if;
 end loop;
 if (v->>'roundAt')::timestamptz-(v->>'serverNow')::timestamptz not between interval '1.5 seconds' and interval '2 seconds' then raise exception 'Later countdown must remain two seconds';end if;
 start_at:=v->>'roundAt';
 for i in 1..8 loop v:=battle_room_view(rid,ids[i]);if v->>'roundAt'<>start_at then raise exception 'Different next-round clocks';end if;end loop;
 if has_function_privilege('authenticated','public.battle_room_play(uuid,text,uuid,jsonb)','execute') or has_table_privilege('authenticated','public.battle_room_members','select') then raise exception 'Private game state exposed';end if;
end;$eight$;
select 'PASS eight-person readiness barrier and service-only permissions' as result;
