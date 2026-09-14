-- Browser clients read their profile through RLS; all writes use the authenticated Edge API.
revoke insert, update, delete, truncate, references, trigger on public.profiles from public, anon, authenticated;
do $$
declare col record; f record;
begin
  for col in select attname from pg_attribute where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped loop
    execute format('revoke insert (%I), update (%I), references (%I) on public.profiles from public, anon, authenticated',col.attname,col.attname,col.attname);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('save_student_test_result_atomic','submit_teacher_exam_atomic','get_student_test_summary','equip_student_emblem_atomic','finalize_due_monthly_rankings','refresh_monthly_ranking_winner','test_result_refresh_monthly_ranking')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;
-- Keep is_staff executable: existing SELECT policies depend on this own-user predicate.
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
