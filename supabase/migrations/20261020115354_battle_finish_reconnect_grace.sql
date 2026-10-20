-- Results are immutable once settled. Final-round reconnects get the same grace as earlier rounds.
do $migration$
declare definition text;old_fragment text;new_fragment text;
begin
 definition:=pg_get_functiondef('public.battle_room_play(uuid,text,uuid,jsonb)'::regprocedure);
 old_fragment:=$old$if r.round+1>=jsonb_array_length(r.questions) then r.status:='finished';$old$;
 new_fragment:=$new$if r.round+1>=jsonb_array_length(r.questions) then
     -- Peers have until their existing 30-second heartbeat deadline to return.
     if not exists(select 1 from battle_room_members where room_id=r.id and left_at is null and seen_at<fresh-interval '6 seconds') then r.status:='finished';end if;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'Unexpected round completion logic';end if;
 definition:=replace(definition,old_fragment,new_fragment);
 old_fragment:=$old$ if r.status='finished' then
  update battle_room_members set left_at=fresh,connection_lost=true where room_id=r.id and left_at is null and seen_at<fresh-interval '6 seconds';
 end if;
$old$;
 if strpos(definition,old_fragment)=0 then raise exception 'Unexpected finished presence logic';end if;
 definition:=replace(definition,old_fragment,'');
 old_fragment:=$old$else update battle_room_members set left_at=coalesce(left_at,fresh) where room_id=r.id and user_id=p_actor;end if;$old$;
 if strpos(definition,old_fragment)=0 then raise exception 'Unexpected leave logic';end if;
 definition:=replace(definition,old_fragment,$new$elsif r.status='playing' then update battle_room_members set left_at=coalesce(left_at,fresh) where room_id=r.id and user_id=p_actor;end if;$new$);
 execute definition;
 definition:=pg_get_functiondef('public.battle_room_view(uuid,uuid)'::regprocedure);
 if strpos(definition,'''soloMode'',r.solo_mode,')=0 then raise exception 'Unexpected room view';end if;
 execute replace(definition,'''soloMode'',r.solo_mode,','''soloMode'',r.solo_mode,''finalizing'',r.status=''playing'' and r.round+1>=jsonb_array_length(r.questions) and r.reveal_until is not null and fresh>=r.reveal_until,');
end;$migration$;
