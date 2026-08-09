-- 내 학습 화면은 최근 기록을 나눠 불러오되 통계는 전체 완료 기록으로 계산합니다.
create or replace function public.get_student_test_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'testCount', count(*)::integer,
    'averageScore', coalesce(round(avg(coalesce(score, 0))), 0)::integer,
    'totalPoint', coalesce(sum(coalesce(points, 0)), 0)::integer,
    'perfectCount', count(*) filter (where coalesce(score, 0) >= 100)::integer
  )
  from public.test_results
  where user_id = p_user_id
$$;

revoke all on function public.get_student_test_summary(uuid) from public;
grant execute on function public.get_student_test_summary(uuid) to service_role;
