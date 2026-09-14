-- 수행평가 공식시험 정책 고정
-- 1) 최초 응시 XP는 기존 선생님 시험과 동일하게 지급
-- 2) 월간 랭킹 포인트는 항상 0
-- 3) 수행평가 결과는 일반 선생님 시험 횟수/PERFECT 등 통계에서 제외

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
  is_school_assessment boolean;
  adjusted_result jsonb;
  saved_result jsonb;
  prior public.test_results%rowtype;
begin
  select attempt, highest_score, status
    into assignment_row
  from public.exam_assignments
  where user_id = p_user_id and exam_id = p_exam_id
  for update;

  if not found then
    raise exception '배정되지 않은 시험입니다.';
  end if;

  select * into prior from public.test_results where id=p_test_id;
  if found then
    if prior.user_id<>p_user_id or prior.teacher_exam_id is distinct from p_exam_id then raise exception '시험 저장 번호가 올바르지 않습니다.'; end if;
    return jsonb_build_object('duplicated',true,'attempt',prior.attempt,'awarded_xp',0,'awarded_points',0,'first_completion',false);
  end if;

  select allow_retake, award_points, source_type, status, starts_at, ends_at
    into exam_row
  from public.teacher_exams
  where id = p_exam_id for share;

  if not found then
    raise exception '시험을 찾을 수 없습니다.';
  end if;

  if exam_row.status in ('cancelled','closed') then raise exception '종료되거나 취소된 시험입니다.'; end if;
  if exam_row.starts_at>clock_timestamp() then raise exception '아직 응시 시간이 아닙니다.'; end if;
  if exam_row.ends_at<clock_timestamp() then raise exception '응시 기간이 끝났습니다.'; end if;
  if assignment_row.status='completed' and not coalesce(exam_row.allow_retake,false) then raise exception '이미 응시를 완료한 시험입니다.'; end if;
  if coalesce((p_result->>'attempt')::integer,0)<>coalesce(assignment_row.attempt,0)+1 then raise exception '이미 제출되었거나 응시 정보가 변경되었습니다. 시험 목록을 다시 열어주세요.'; end if;

  is_school_assessment := coalesce(exam_row.source_type, '') = '수행평가';

  first_completion := not exists (
    select 1
    from public.test_results
    where user_id = p_user_id
      and teacher_exam_id = p_exam_id
      and test_kind in ('teacher', 'school_assessment')
  );

  next_attempt := coalesce(assignment_row.attempt, 0) + 1;

  awarded_xp := case
    when first_completion then greatest(coalesce(p_base_xp, 0), 0)
    else 0
  end;

  awarded_points := case
    when first_completion
      and not is_school_assessment
      and coalesce(exam_row.award_points, true)
      then greatest(coalesce(p_base_xp, 0), 0)
    else 0
  end;

  adjusted_result := jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(p_result, '{}'::jsonb),
        '{attempt}', to_jsonb(next_attempt), true
      ),
      '{points}', to_jsonb(awarded_points), true
    ),
    '{test_kind}',
    to_jsonb(case when is_school_assessment then 'school_assessment' else 'teacher' end),
    true
  );

  select public.save_student_test_result_atomic(
    p_user_id,
    p_test_id,
    adjusted_result,
    coalesce(p_wrongs, '[]'::jsonb),
    awarded_xp,
    case when first_completion
      then case
        when is_school_assessment
          then 'school_assessment:' || p_user_id::text || ':' || p_exam_id::text || ':first'
        else 'teacher:' || p_user_id::text || ':' || p_exam_id::text || ':first'
      end
      else null
    end
  ) into saved_result;

  if is_school_assessment then
    update public.test_results
    set test_kind = 'school_assessment',
        status = 'school_assessment',
        points = 0
    where id = p_test_id
      and user_id = p_user_id;
  end if;

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
    'awarded_points', awarded_points,
    'school_assessment', is_school_assessment
  );
end;
$$;

revoke all on function public.submit_teacher_exam_atomic(uuid,uuid,uuid,jsonb,jsonb,integer) from public;
grant execute on function public.submit_teacher_exam_atomic(uuid,uuid,uuid,jsonb,jsonb,integer) to service_role;
