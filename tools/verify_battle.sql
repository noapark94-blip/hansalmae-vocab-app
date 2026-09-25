begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();room uuid;r jsonb;q jsonb;qs jsonb;i integer;blocked boolean;
begin
 insert into auth.users(id) values(a),(b),(c);
 insert into public.profiles(id,student_id,display_name) values(a,'__battle_test_a','검증 A'),(b,'__battle_test_b','검증 B'),(c,'__battle_test_c','검증 C');
 perform public.battle_social(a,'request',b);
 begin perform public.battle_social(a,'accept',b);raise exception 'FAIL selfaccept';exception when others then if SQLERRM='FAIL selfaccept' then raise;end if;end;
 perform public.battle_social(b,'accept',a);
 assert jsonb_array_length(public.battle_social(a,'home')->'friends')=1,'friend accept';
 select jsonb_agg(jsonb_build_object('prompt','test'||n,'word','test'||n,'meaning','뜻'||n,'example','test example','translation','예문','mode','engToKor','correctId','correct'||n,'options',jsonb_build_array(jsonb_build_object('id','correct'||n,'text','뜻'||n),jsonb_build_object('id','wrong'||n,'text','오답')))) into qs from generate_series(0,9)n;
 r:=public.battle_play(a,'invite',null,jsonb_build_object('target',b,'questions',qs,'settings','{"title":"검증","mode":"mixed"}'::jsonb));room:=(r->>'id')::uuid;
 assert r->>'status'='invited';assert r->'question'='null'::jsonb;
 begin perform public.battle_play(c,'poll',room);raise exception 'FAIL outsider';exception when others then if SQLERRM='FAIL outsider' then raise;end if;end;
 begin perform public.battle_play(a,'accept',room);raise exception 'FAIL hostaccept';exception when others then if SQLERRM='FAIL hostaccept' then raise;end if;end;
 begin perform public.battle_play(a,'invite',null,jsonb_build_object('target',b,'questions',qs,'settings','{}'::jsonb));raise exception 'FAIL overlap';exception when others then if SQLERRM='FAIL overlap' then raise;end if;end;
 perform public.battle_play(b,'accept',room);perform public.battle_play(a,'ready',room);r:=public.battle_play(b,'ready',room);
 assert r->>'status'='playing';assert extract(epoch from((r->>'deadline')::timestamptz-(r->>'roundAt')::timestamptz))=10,'10 second deadline';assert r->'question'='null'::jsonb,'countdown leak';
 r:=public.battle_play(a,'answer',room,'{"round":0,"choice":"correct0"}');assert r->>'answered'='false','early answer';
 for i in 0..9 loop
  update public.word_battles set round_at=clock_timestamp()-interval '1 second' where id=room;
  r:=public.battle_play(a,'poll',room);assert r->'question'->'correctId'='null'::jsonb,'answer leak';
  r:=public.battle_play(a,'answer',room,jsonb_build_object('round',i,'choice','correct'||i));assert r->>'answered'='true';assert r->'question'->'correctId'='null'::jsonb,'early reveal';
  r:=public.battle_play(a,'answer',room,jsonb_build_object('round',i,'choice','wrong'||i));assert r->>'choice'='correct'||i,'duplicate replaced';
  r:=public.battle_play(b,'answer',room,jsonb_build_object('round',i,'choice','wrong'||i));assert r->'question'->>'correctId'='correct'||i;assert (r->>'hostScore')::int=i+1;assert (r->>'guestScore')::int=0;
  r:=public.battle_play(b,'poll',room);assert (r->>'hostScore')::int=i+1,'double score';
  update public.word_battles set reveal_until=clock_timestamp()-interval '1 second' where id=room;
  r:=public.battle_play(a,'poll',room);
 end loop;
 assert r->>'status'='finished';assert (r->>'winner')::uuid=a;assert jsonb_array_length(r->'review')=10;
 r:=public.battle_play(b,'poll',room);assert not (r->'review'->0->>'correct')::boolean;
 -- Second room: timeout and forfeit.
 r:=public.battle_play(a,'invite',null,jsonb_build_object('target',b,'questions',qs,'settings','{}'::jsonb));room:=(r->>'id')::uuid;
 perform public.battle_play(b,'accept',room);perform public.battle_play(a,'ready',room);perform public.battle_play(b,'ready',room);
 update public.word_battles set round_at=clock_timestamp()-interval '11 seconds' where id=room;
 r:=public.battle_play(a,'answer',room,'{"round":0,"choice":"correct0"}');assert r->>'answered'='false','late answer must be rejected';assert r->'revealUntil'<>'null'::jsonb;assert (r->>'hostScore')::int=0;
 r:=public.battle_play(b,'leave',room);assert (r->>'winner')::uuid=a;
 perform public.battle_social(a,'block',b);
 assert jsonb_array_length(public.battle_social(a,'home')->'friends')=0;
 assert public.battle_social(b,'search',null,'__battle_test_a')->'person'='null'::jsonb;
 begin perform public.battle_social(b,'request',a);raise exception 'FAIL blocked';exception when others then if SQLERRM='FAIL blocked' then raise;end if;end;
 assert not has_table_privilege('authenticated','public.word_battles','SELECT');
 assert not has_function_privilege('anon','public.battle_play(uuid,text,uuid,jsonb)','EXECUTE');
 assert not has_function_privilege('authenticated','public.battle_social(uuid,text,uuid,text)','EXECUTE');
end;
$$;
rollback;
select 'PASS: friendship, isolation, countdown, duplicate answers, reveal, 10 rounds, timeout, forfeit, block, grants. Fixtures rolled back.' as verification;
