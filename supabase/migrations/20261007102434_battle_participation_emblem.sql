-- Preserve completion even after a student leaves the result screen.
alter table public.battle_room_members add column completed boolean not null default false;
create function public.battle_capture_completion() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.status='finished' and old.status<>'finished' and new.reason is null
    and jsonb_array_length(new.questions)>0
    and new.round=jsonb_array_length(new.questions)-1 and new.reveal_until is not null then
  update public.battle_room_members set completed=true where room_id=new.id and left_at is null;
 end if;
 return new;
end;
$$;
revoke all on function public.battle_capture_completion() from public,anon,authenticated;
grant execute on function public.battle_capture_completion() to service_role;
create trigger battle_capture_completion after update of status on public.battle_rooms
for each row execute function public.battle_capture_completion();

-- Historical rooms have the final reveal deadline, but no explicit finish timestamp.
-- A result-screen departure after that deadline must not erase completed participation.
update public.battle_room_members m set completed=true
from public.battle_rooms r where r.id=m.room_id and r.status='finished' and r.reason is null
 and jsonb_array_length(r.questions)>0 and r.round=jsonb_array_length(r.questions)-1
 and r.reveal_until is not null and (m.left_at is null or m.left_at>r.reveal_until);

create function public.battle_completed_count(p_user_id uuid) returns integer
language sql stable security invoker set search_path=public as $$
 select (select count(*) from battle_room_members where user_id=p_user_id and completed)
      + (select count(*) from word_battles where p_user_id in(host,guest)
         and status='finished' and reason is null and jsonb_array_length(questions)>0
         and round=jsonb_array_length(questions)-1 and reveal_until is not null);
$$;
revoke all on function public.battle_completed_count(uuid) from public,anon,authenticated;
grant execute on function public.battle_completed_count(uuid) to service_role;

insert into public.emblem_settings(id,name,image_path,condition_type,condition_value,sort_order,enabled)
values('achievement_battle_chick','쌈닭','./images/emblems/achievement-battle-chick.png','BATTLE_COMPLETE_COUNT','3',21,true);
