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
begin
  select attempt, highest_score
    into assignment_row
  from public.exam_assignments
  where user_id = p_user_id and exam_id = p_exam_id
  for update;

  if not found then
    raise exception '배정되지 않은 시험입니다.';
  end if;

  select allow_retake, award_points, source_type
    into exam_row
  from public.teacher_exams
  where id = p_exam_id;

  if not found then
    raise exception '시험을 찾을 수 없습니다.';
  end if;

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

-- 오래된 화면/클라이언트가 award_points=true를 보내도 DB에서 수행평가는 무조건 false로 고정합니다.
create or replace function public.force_school_assessment_no_points()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_type = '수행평가' then
    new.award_points := false;
  end if;
  return new;
end;
$$;

drop trigger if exists teacher_exams_force_school_assessment_no_points on public.teacher_exams;
create trigger teacher_exams_force_school_assessment_no_points
before insert or update of source_type, award_points on public.teacher_exams
for each row execute function public.force_school_assessment_no_points();

-- 이미 저장된 수행평가 공식시험 결과도 동일 정책으로 정리합니다.
update public.test_results tr
set test_kind = 'school_assessment',
    status = 'school_assessment',
    points = 0
from public.teacher_exams te
where tr.teacher_exam_id = te.id
  and te.source_type = '수행평가'
  and (
    tr.test_kind is distinct from 'school_assessment'
    or tr.status is distinct from 'school_assessment'
    or tr.points <> 0
  );

update public.teacher_exams
set award_points = false
where source_type = '수행평가'
  and award_points is distinct from false;
