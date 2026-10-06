-- Allow temporary network loss without bypassing the shared readiness barrier.
DO $migration$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.battle_room_play(uuid,text,uuid,jsonb)'::regprocedure);
 IF strpos(definition, 'r.prepare_at+interval ''12 seconds''')=0 THEN RAISE EXCEPTION 'Unexpected readiness timeout'; END IF;
 EXECUTE replace(definition,'r.prepare_at+interval ''12 seconds''','r.prepare_at+interval ''30 seconds''');
 definition:=pg_get_functiondef('public.battle_room_view(uuid,uuid)'::regprocedure);
 IF strpos(definition, '''syncEnabled'',r.sync_enabled,')=0 THEN RAISE EXCEPTION 'Unexpected room view'; END IF;
 EXECUTE replace(definition,'''syncEnabled'',r.sync_enabled,','''prepareDeadline'',r.prepare_at+interval ''30 seconds'',''syncEnabled'',r.sync_enabled,');
END;
$migration$;
