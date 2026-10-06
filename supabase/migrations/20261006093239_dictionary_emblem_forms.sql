-- A form remains the default; variants are appearance only, not new emblems.
alter table public.student_emblems add column form text not null default 'A'
  check (form = 'A' or (emblem_id = 'title_dictionary' and form = 'B'));

-- Called only by the authenticated application server after profileFromToken.
create function public.equip_student_emblem_form_atomic(p_user_id uuid, p_emblem_id text, p_form text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_form is not null and (p_form not in ('A','B') or (p_form='B' and p_emblem_id<>'title_dictionary')) then
    raise exception '선택할 수 없는 엠블럼 폼입니다.';
  end if;
  -- Serialize concurrent equipment changes for the same student.
  perform 1 from public.profiles where id=p_user_id for update;
  if not exists(select 1 from public.student_emblems se join public.emblem_settings e on e.id=se.emblem_id
    where se.user_id=p_user_id and se.emblem_id=p_emblem_id and e.enabled) then
    raise exception '아직 획득하지 않은 엠블럼입니다.';
  end if;
  perform public.equip_student_emblem_atomic(p_user_id,p_emblem_id);
  if p_form is not null then
    update public.student_emblems set form=p_form where user_id=p_user_id and emblem_id=p_emblem_id;
  end if;
end;
$$;
revoke all on function public.equip_student_emblem_form_atomic(uuid,text,text) from public, anon, authenticated;
grant execute on function public.equip_student_emblem_form_atomic(uuid,text,text) to service_role;

-- All battle views and new match snapshots use the stored appearance.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('public.battle_person(uuid)'::regprocedure);
  if position('select e.image_path from student_emblems' in definition)=0 then
    raise exception 'Unexpected battle_person definition';
  end if;
  execute replace(definition,'select e.image_path from student_emblems',
    'select case when e.id=''title_dictionary'' and se.form=''B'' then ''./images/emblems/title-dictionary-b.png'' else e.image_path end from student_emblems');
end;
$migration$;
