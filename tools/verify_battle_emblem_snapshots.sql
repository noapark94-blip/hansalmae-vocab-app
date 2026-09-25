begin;
do $test$
declare source public.word_battles; fixture uuid; result jsonb; listing jsonb; frozen_host text; frozen_guest text;
begin
 select b.* into source from public.word_battles b join public.battle_friends f
 on f.low_id=least(b.host,b.guest) and f.high_id=greatest(b.host,b.guest) and f.status='accepted'
 where b.status='finished' and exists(select 1 from public.student_emblems se join public.emblem_settings e on e.id=se.emblem_id where se.user_id in(b.host,b.guest) and se.equipped and e.enabled and e.image_path<>'./images/emblems/title-chick.png')
 order by b.created_at desc limit 1;
 if source.id is null then raise exception 'No suitable rollback fixture'; end if;
 insert into public.word_battles(host,guest,status,settings,questions,host_ready,rewards_enabled)
 values(source.host,source.guest,'ready',source.settings,source.questions,true,false) returning id into fixture;
 result:=public.battle_play(source.guest,'ready',fixture);
 frozen_host:=result->'host'->>'image'; frozen_guest:=result->'guest'->>'image';
 if result->>'status'<>'playing' or frozen_host is null or frozen_guest is null then raise exception 'Start snapshot failed'; end if;
 update public.student_emblems set equipped=false where user_id in(source.host,source.guest) and equipped;
 if public.battle_person(source.host)->>'image'=frozen_host and public.battle_person(source.guest)->>'image'=frozen_guest then raise exception 'Equipment fixture did not change'; end if;
 result:=public.battle_play(source.host,'poll',fixture);
 if result->'host'->>'image'<>frozen_host or result->'guest'->>'image'<>frozen_guest then raise exception 'Live snapshot changed'; end if;
 update public.word_battles set status='finished' where id=fixture;
 result:=public.battle_play(source.host,'poll',fixture);
 if result->'host'->>'image'<>frozen_host or result->'guest'->>'image'<>frozen_guest then raise exception 'Result snapshot changed'; end if;
 listing:=public.battle_social(source.host,'home');
 if (select value->'opponent'->>'image' from jsonb_array_elements(listing->'battles') where value->>'id'=fixture::text) is distinct from frozen_guest then raise exception 'Host history snapshot changed'; end if;
 listing:=public.battle_social(source.guest,'home');
 if (select value->'opponent'->>'image' from jsonb_array_elements(listing->'battles') where value->>'id'=fixture::text) is distinct from frozen_host then raise exception 'Guest history snapshot changed'; end if;
end $test$;
select 'PASS: start capture, equipment change, live/result/history for both players; all test writes rolled back' as verification;
rollback;
