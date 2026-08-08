-- 1차 안정화: 시험 결과, 오답, 경험치를 하나의 트랜잭션으로 저장합니다.
create or replace function public.save_student_test_result_atomic(
  p_user_id uuid,
  p_test_id uuid,
  p_result jsonb,
  p_wrongs jsonb default '[]'::jsonb,
  p_earned_xp integer default 0,
  p_payout_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w jsonb;
  total_xp_value integer;
  level_row record;
  saved_wrong_count integer := 0;
begin
  if p_user_id is null or p_test_id is null then
    raise exception '시험 저장 정보가 올바르지 않습니다.';
  end if;

  insert into public.test_results(
    id,user_id,test_kind,teacher_exam_id,word_set_id,start_day,end_day,
    question_type,question_count,correct_count,score,grade,points,attempt,raw_result
  ) values (
    p_test_id,p_user_id,
    coalesce(nullif(p_result->>'test_kind',''),'free'),
    nullif(p_result->>'teacher_exam_id','')::uuid,
    nullif(p_result->>'word_set_id','')::uuid,
    nullif(p_result->>'start_day','')::integer,
    nullif(p_result->>'end_day','')::integer,
    coalesce(p_result->>'question_type',''),
    coalesce((p_result->>'question_count')::integer,0),
    coalesce((p_result->>'correct_count')::integer,0),
    coalesce((p_result->>'score')::numeric,0),
    coalesce(p_result->>'grade',''),
    coalesce((p_result->>'points')::integer,0),
    coalesce((p_result->>'attempt')::integer,1),
    coalesce(p_result->'raw_result','{}'::jsonb)
  ) on conflict(id) do nothing;

  if not found then
    select total_xp into total_xp_value
    from public.student_experience where user_id=p_user_id;
    return jsonb_build_object(
      'duplicated',true,
      'total_xp',coalesce(total_xp_value,0),
      'saved_wrong_count',0
    );
  end if;

  for w in select value from jsonb_array_elements(coalesce(p_wrongs,'[]'::jsonb))
  loop
    update public.wrong_words set
      meaning=coalesce(w->>'meaning',''),
      example=coalesce(w->>'example',''),
      translation=coalesce(w->>'translation',''),
      wrong_count=wrong_count+1,
      last_wrong_at=now(),
      mastered=false
    where user_id=p_user_id
      and word_set_id is not distinct from nullif(w->>'word_set_id','')::uuid
      and day is not distinct from nullif(w->>'day','')::integer
      and word=coalesce(w->>'word','');

    if not found then
      insert into public.wrong_words(
        user_id,word_set_id,day,word,meaning,example,translation
      ) values (
        p_user_id,
        nullif(w->>'word_set_id','')::uuid,
        nullif(w->>'day','')::integer,
        coalesce(w->>'word',''),
        coalesce(w->>'meaning',''),
        coalesce(w->>'example',''),
        coalesce(w->>'translation','')
      );
    end if;
    saved_wrong_count := saved_wrong_count + 1;
  end loop;

  insert into public.student_experience(user_id)
  values(p_user_id) on conflict(user_id) do nothing;

  select total_xp into total_xp_value
  from public.student_experience
  where user_id=p_user_id for update;

  if p_payout_key is not null and not exists(
    select 1 from public.experience_logs where payout_key=p_payout_key
  ) then
    total_xp_value := coalesce(total_xp_value,0)+greatest(coalesce(p_earned_xp,0),0);
    select level,title into level_row
    from public.level_settings
    where required_xp<=total_xp_value
    order by required_xp desc limit 1;

    update public.student_experience set
      total_xp=total_xp_value,
      level=coalesce(level_row.level,1),
      title=coalesce(level_row.title,'단어병아리'),
      last_earned_at=now(),
      updated_at=now()
    where user_id=p_user_id;

    insert into public.experience_logs(
      user_id,test_kind,test_id,question_count,score,base_xp,
      repeat_rate,earned_xp,total_after,payout_key
    ) values (
      p_user_id,p_result->>'test_kind',p_test_id,
      coalesce((p_result->>'question_count')::integer,0),
      coalesce((p_result->>'score')::numeric,0),
      greatest(coalesce(p_earned_xp,0),0),1,
      greatest(coalesce(p_earned_xp,0),0),total_xp_value,p_payout_key
    );
  end if;

  return jsonb_build_object(
    'duplicated',false,
    'total_xp',coalesce(total_xp_value,0),
    'saved_wrong_count',saved_wrong_count
  );
end;
$$;

revoke all on function public.save_student_test_result_atomic(uuid,uuid,jsonb,jsonb,integer,text) from public;
grant execute on function public.save_student_test_result_atomic(uuid,uuid,jsonb,jsonb,integer,text) to service_role;
