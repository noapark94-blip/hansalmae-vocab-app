-- Run inside a transaction and ROLLBACK. Uses existing students only as FK references.
create function pg_temp.reward_fixture(h uuid,g uuid,n integer,hc integer,gc integer,early boolean default false,finish boolean default true) returns uuid language plpgsql as $$
declare bid uuid;qs jsonb;ans jsonb:='{}';i integer;src uuid;
begin
 insert into public.battle_friends(low_id,high_id,requester,status) values(least(h,g),greatest(h,g),h,'accepted') on conflict(low_id,high_id) do update set status='accepted';
 delete from public.battle_blocks where (actor=h and target=g) or (actor=g and target=h);
 select id into src from public.word_sets where enabled and public.ranking_category_from_name(name)='middle' order by id limit 1;
 select jsonb_agg(jsonb_build_object('word','fixture'||v,'meaning','뜻'||v,'mode','engToKor','prompt','fixture'||v,'correctId','a','options',jsonb_build_array(jsonb_build_object('id','a','text','정답'),jsonb_build_object('id','b','text','오답'),jsonb_build_object('id','c','text','보기'),jsonb_build_object('id','d','text','다른 보기')))) into qs from generate_series(1,n)v;
 for i in 0..n-1 loop
  ans:=ans||jsonb_build_object(i::text||':'||h::text,jsonb_build_object('choice',case when i<hc then 'a' else 'b' end,'ms',1000),i::text||':'||g::text,jsonb_build_object('choice',case when i<gc then 'a' else 'b' end,'ms',1000));
 end loop;
 insert into public.word_battles(host,guest,status,settings,questions,answers,round,reveal_until,host_score,guest_score,winner,reason)
 values(h,g,'playing',jsonb_build_object('source',src,'kind','standard','title','중등단어DB','mode','mixed','start',1,'end',1,'count',n,'seconds',10),qs,ans,n-1,now(),hc,gc,case when early then g when hc>gc then h when gc>hc then g else null end,case when early then '상대가 대전을 종료했어요.' else null end) returning id into bid;
 if finish then update public.word_battles set status='finished' where id=bid;end if;
 return bid;
end;$$;
do $$
declare h uuid;g uuid;t uuid;bid uuid;r public.battle_rewards;x integer;y integer;j jsonb;
begin
 select id into h from public.profiles where role='student' and enabled order by id limit 1;
 select id into g from public.profiles where role='student' and enabled and id<>h order by id limit 1;
 select id into t from public.profiles where role='student' and enabled and id not in(h,g) order by id limit 1;
 if t is null then raise exception 'Need three fixture FK references';end if;
 -- Test starts with this new table empty; no real reward rows are removed.
 if exists(select 1 from public.battle_rewards) then raise exception 'Use isolated transaction before activation';end if;
 bid:=pg_temp.reward_fixture(h,g,10,8,7);
 select * into r from public.battle_rewards where battle_id=bid and user_id=h;
 if r.points<>5 or r.xp<>21 or r.total_after-r.total_before<>21 then raise exception '10Q win failed: %',row_to_json(r);end if;
 select * into r from public.battle_rewards where battle_id=bid and user_id=g;
 if r.points<>1 or r.xp<>19 then raise exception '10Q loss failed';end if;
 select total_xp into x from public.student_experience where user_id=h;
 perform public.battle_settle_rewards(bid);
 select total_xp into y from public.student_experience where user_id=h;
 if x<>y or (select count(*) from public.battle_rewards where battle_id=bid)<>2 then raise exception 'Duplicate payout';end if;
 j:=public.battle_play(h,'poll',bid);
 if j->'reward'->>'points'<>'5' then raise exception 'Poll reward missing';end if;
 bid:=pg_temp.reward_fixture(h,g,20,15,15);
 select * into r from public.battle_rewards where battle_id=bid and user_id=h;
 if r.points<>6 or r.xp<>40 then raise exception '20Q draw failed';end if;
 bid:=pg_temp.reward_fixture(h,g,30,20,10);
 select * into r from public.battle_rewards where battle_id=bid and user_id=h;
 if r.points<>15 or r.xp<>55 then raise exception '30Q win failed';end if;
 bid:=pg_temp.reward_fixture(h,g,10,10,5);
 select * into r from public.battle_rewards where battle_id=bid and user_id=h;
 if r.points<>0 or r.xp<>0 or r.reason<>'pair_limit' then raise exception 'Pair cap failed';end if;
 bid:=pg_temp.reward_fixture(h,t,30,30,0);
 bid:=pg_temp.reward_fixture(h,t,30,30,0);
 select * into r from public.battle_rewards where battle_id=bid and user_id=h;
 if r.eligible_count<>10 or r.points<>5 or r.xp<>25 or r.reason<>'partial' then raise exception '100Q partial cap failed: %',row_to_json(r);end if;
 bid:=pg_temp.reward_fixture(h,t,10,10,0);
 select * into r from public.battle_rewards where battle_id=bid and user_id=h;
 if r.points<>0 or r.xp<>0 or r.reason<>'daily_limit' then raise exception 'Daily cap failed';end if;
 bid:=pg_temp.reward_fixture(g,t,10,8,7,true);
 select * into r from public.battle_rewards where battle_id=bid and user_id=g;
 if r.points<>0 or r.xp<>0 or r.reason<>'forfeit' then raise exception 'Forfeiter paid';end if;
 select * into r from public.battle_rewards where battle_id=bid and user_id=t;
 if r.points<>0 or r.xp<>14 or r.reason<>'opponent_left' then raise exception 'Opponent compensation failed: %',row_to_json(r);end if;

 if (select sum(eligible_count) from public.battle_rewards where user_id=h)<>100 then raise exception 'Cap exceeded';end if;
 -- A new Seoul day resets both limits; prior matches remain immutable.
 update public.battle_rewards set reward_day=reward_day-1;
 j:=public.battle_reward_allowance(h,g);
 if j->>'remaining'<>'100' or j->>'pairRemaining'<>'3' then raise exception 'Seoul day reset failed';end if;
 -- Re-polling old matches cannot claim another day's rewards.
 perform public.battle_settle_rewards(bid);
 if exists(select 1 from public.battle_rewards where reward_day=(now() at time zone 'Asia/Seoul')::date) then raise exception 'Old payout reclaimed';end if;

 -- Legacy rooms never get paid, including when re-opened after activation.
 bid:=pg_temp.reward_fixture(h,g,10,8,7,false,false);
 update public.word_battles set rewards_enabled=false,status='finished' where id=bid;
 perform public.battle_settle_rewards(bid);
 if exists(select 1 from public.battle_rewards where battle_id=bid) then raise exception 'Legacy room paid';end if;
 -- Use the real poll transition to finish and settle a school match.
 bid:=pg_temp.reward_fixture(h,g,10,8,7,false,false);
 update public.word_battles set settings=settings||jsonb_build_object('kind','school','title','학교 수행평가') where id=bid;
 j:=public.battle_play(h,'poll',bid);
 if j->>'status'<>'finished' or j->'reward'->>'points'<>'5' then raise exception 'Poll settlement failed';end if;
 select * into r from public.battle_rewards where battle_id=bid and user_id=h;
 if not exists(select 1 from public.test_results tr join public.word_sets ws on ws.id=tr.word_set_id join public.profiles p on p.id=tr.user_id where tr.id=r.test_id and public.ranking_category_from_name(ws.name)=coalesce(public.ranking_grade_group(p.base_grade,p.base_year,date_trunc('month',now() at time zone 'Asia/Seoul')::date),'middle')) then raise exception 'School ranking category failed';end if;
 if has_function_privilege('anon','public.battle_settle_rewards(uuid)','EXECUTE') or has_function_privilege('authenticated','public.battle_reward_allowance(uuid,uuid)','EXECUTE') or has_table_privilege('authenticated','public.battle_rewards','SELECT') then raise exception 'Reward privilege leak';end if;
 if not exists(select 1 from public.test_results where id=r.test_id and test_kind='battle') then raise exception 'Missing existing ledger integration';end if;

end;$$;
