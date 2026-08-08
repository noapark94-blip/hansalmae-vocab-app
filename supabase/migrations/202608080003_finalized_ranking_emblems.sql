-- 2차: 월말 확정 당시의 학년/부문을 보존하고 임시 1위 지급을 차단합니다.
alter table public.monthly_ranking_history
  add column if not exists category text,
  add column if not exists winner_grade_group text,
  add column if not exists finalized boolean not null default false;

create index if not exists monthly_ranking_finalized_user_idx
on public.monthly_ranking_history(user_id, finalized, month desc, category);

create or replace function public.ranking_category_from_name(set_name text)
returns text language sql immutable as $$
  select case
    when coalesce(set_name,'') like '%중등%' then 'middle'
    when coalesce(set_name,'') like '%고등%' then 'high'
    when coalesce(set_name,'') like '%수능%' then 'csat'
    else null
  end
$$;

create or replace function public.ranking_grade_group(
  base_grade_value text,
  base_year_value integer,
  target_month date
)
returns text language plpgsql immutable as $$
declare
  normalized text := replace(coalesce(base_grade_value,''),' ','');
  grade_number integer;
  elapsed integer := greatest(extract(year from target_month)::integer-coalesce(base_year_value,extract(year from target_month)::integer),0);
begin
  if normalized like '고%' or normalized='졸업' then return 'high'; end if;
  if normalized like '중%' then
    grade_number := coalesce(nullif(regexp_replace(normalized,'[^0-9]','','g'),''),'1')::integer + elapsed;
    return case when grade_number>3 then 'high' else 'middle' end;
  end if;
  return null;
end;
$$;

create or replace function public.refresh_monthly_ranking_winner(
  target_word_set_id uuid,
  target_month date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  winner record;
  range_start timestamptz;
  range_end timestamptz;
  set_name text;
  category_value text;
  grade_group_value text;
  finalized_value boolean;
begin
  if target_word_set_id is null or target_month is null then return; end if;
  range_start := target_month::timestamp at time zone 'Asia/Seoul';
  range_end := (target_month + interval '1 month')::timestamp at time zone 'Asia/Seoul';
  select name into set_name from public.word_sets where id=target_word_set_id;
  category_value := public.ranking_category_from_name(set_name);
  finalized_value := target_month < date_trunc('month',now() at time zone 'Asia/Seoul')::date;

  delete from public.monthly_ranking_history
  where month=target_month and word_set_id=target_word_set_id and rank=1;

  select tr.user_id,sum(tr.points)::integer as total_points,p.base_grade,p.base_year
  into winner
  from public.test_results tr
  join public.profiles p on p.id=tr.user_id
  where tr.word_set_id=target_word_set_id
    and tr.status='completed'
    and tr.taken_at>=range_start and tr.taken_at<range_end
    and tr.points>0
  group by tr.user_id,p.base_grade,p.base_year,p.display_name
  order by sum(tr.points) desc,
    count(*) filter(where tr.score>=100) desc,
    count(*) desc,p.display_name asc
  limit 1;

  if winner.user_id is not null then
    grade_group_value := public.ranking_grade_group(winner.base_grade,winner.base_year,target_month);
    insert into public.monthly_ranking_history(
      month,word_set_id,user_id,rank,points,recorded_at,
      category,winner_grade_group,finalized
    ) values(
      target_month,target_word_set_id,winner.user_id,1,winner.total_points,now(),
      category_value,grade_group_value,finalized_value
    );
  end if;
end;
$$;

create or replace function public.finalize_due_monthly_rankings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r record; processed integer := 0;
begin
  for r in
    select distinct month,word_set_id
    from public.monthly_ranking_history
    where finalized=false
      and month<date_trunc('month',now() at time zone 'Asia/Seoul')::date
  loop
    perform public.refresh_monthly_ranking_winner(r.word_set_id,r.month);
    processed := processed+1;
  end loop;
  return processed;
end;
$$;

-- 기존 기록도 동일 기준으로 다시 표시합니다. 현재 달은 확정되지 않습니다.
do $$ declare r record;
begin
  for r in select distinct month,word_set_id from public.monthly_ranking_history
  loop perform public.refresh_monthly_ranking_winner(r.word_set_id,r.month); end loop;
end $$;

revoke all on function public.finalize_due_monthly_rankings() from public;
grant execute on function public.finalize_due_monthly_rankings() to service_role;

create or replace function public.equip_student_emblem_atomic(
  p_user_id uuid,
  p_emblem_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(
    select 1 from public.student_emblems
    where user_id=p_user_id and emblem_id=p_emblem_id
  ) then
    raise exception '아직 획득하지 않은 엠블럼입니다.';
  end if;
  update public.student_emblems set equipped=false
  where user_id=p_user_id and equipped=true;
  update public.student_emblems set equipped=true
  where user_id=p_user_id and emblem_id=p_emblem_id;
end;
$$;

revoke all on function public.equip_student_emblem_atomic(uuid,text) from public;
grant execute on function public.equip_student_emblem_atomic(uuid,text) to service_role;
