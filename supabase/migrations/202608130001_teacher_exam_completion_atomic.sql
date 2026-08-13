-- 선생님 시험 완료 안정화
-- 최초 완료만 XP/포인트를 지급하고, 결과·경험치·완료 상태·진행 삭제를 한 트랜잭션으로 처리합니다.
create or replace function public.submit_teacher_exam_atomic(
  p_user_id uuid,
  p_exam_id uuid,
  p_test_id uuid,
  p_result jsonb,
  p_wrongs jsonb default '[]'::jsonb,
  p_base_xp integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row record;
  exam_row record;
  first_completion boolean;
  next_attempt integer;
  awarded_xp integer;
  awarded_points integer;
  adjusted_result jsonb;
  saved_result jsonb;
begin
  select attempt, highest_score
    into assignment_row
  from public.exam_assignments
  where user_id = p_user_id and exam_id = p_exam_id
  for update;

  if not found then
    raise exception '배정되지 않은 시험입니다.';
  end if;

  select allow_retake, award_points
    into exam_row
  from public.teacher_exams
  where id = p_exam_id;

  if not found then
    raise exception '시험을 찾을 수 없습니다.';
  end if;

  first_completion := not exists (
    select 1
    from public.test_results
    where user_id = p_user_id
      and teacher_exam_id = p_exam_id
      and test_kind = 'teacher'
      and status = 'completed'
  );

  next_attempt := coalesce(assignment_row.attempt, 0) + 1;
  awarded_xp := case when first_completion then greatest(coalesce(p_base_xp, 0), 0) else 0 end;
  awarded_points := case
    when first_completion and coalesce(exam_row.award_points, true)
      then greatest(coalesce(p_base_xp, 0), 0)
    else 0
  end;

  adjusted_result := jsonb_set(
    jsonb_set(coalesce(p_result, '{}'::jsonb), '{attempt}', to_jsonb(next_attempt), true),
    '{points}', to_jsonb(awarded_points), true
  );

  select public.save_student_test_result_atomic(
    p_user_id,
    p_test_id,
    adjusted_result,
    coalesce(p_wrongs, '[]'::jsonb),
    awarded_xp,
    case when first_completion
      then 'teacher:' || p_user_id::text || ':' || p_exam_id::text || ':first'
      else null
    end
  ) into saved_result;

  update public.exam_assignments
  set status = 'completed',
      attempt = next_attempt,
      highest_score = greatest(
        coalesce(highest_score, 0),
        coalesce((adjusted_result->>'score')::numeric, 0)
      ),
      completed_at = now()
  where user_id = p_user_id and exam_id = p_exam_id;

  delete from public.exam_progress
  where user_id = p_user_id and scope_key = 'teacher:' || p_exam_id::text;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = p_user_id and exam_id = p_exam_id;

  return coalesce(saved_result, '{}'::jsonb) || jsonb_build_object(
    'first_completion', first_completion,
    'attempt', next_attempt,
    'awarded_xp', awarded_xp,
    'awarded_points', awarded_points
  );
end;
$$;

revoke all on function public.submit_teacher_exam_atomic(uuid,uuid,uuid,jsonb,jsonb,integer) from public;
grant execute on function public.submit_teacher_exam_atomic(uuid,uuid,uuid,jsonb,jsonb,integer) to service_role;
