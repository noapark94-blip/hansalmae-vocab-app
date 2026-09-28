-- Keep one authoritative room clock: first question gets four seconds after
-- every active participant acknowledges readiness; later questions keep two.
DO $migration$
DECLARE
 definition text := pg_get_functiondef('public.battle_room_play(uuid,text,uuid,jsonb)'::regprocedure);
 old_timing text := 'r.round_at:=fresh+interval ''2 seconds'';';
 new_timing text := 'r.round_at:=fresh+case when r.round=0 then interval ''4 seconds'' else interval ''2 seconds'' end;';
BEGIN
 IF strpos(definition, new_timing)>0 THEN RETURN; END IF;
 IF (length(definition)-length(replace(definition,old_timing,'')))/length(old_timing)<>1 THEN
  RAISE EXCEPTION 'Unexpected battle countdown definition; refusing to replace';
 END IF;
 EXECUTE replace(definition,old_timing,new_timing);
END;
$migration$;
