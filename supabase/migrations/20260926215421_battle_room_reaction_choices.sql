do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.battle_room_play(uuid,text,uuid,jsonb)'::regprocedure) into definition;
 if position('''👋'',''😂'',''🔥'',''👍'',''😭'',''👏'',''💗''' in definition)=0 then raise exception 'Expected reaction allowlist not found'; end if;
 definition := replace(definition,'''👋'',''😂'',''🔥'',''👍'',''😭'',''👏'',''💗''','''👋'',''😂'',''🔥'',''👍'',''😭'',''👏'',''💗'',''😄'',''😛''');
 execute definition;
end $migration$;
