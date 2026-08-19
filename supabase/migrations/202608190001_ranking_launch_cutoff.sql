-- 랭킹/랭킹 엠블럼은 2026-08-01부터 운영을 시작합니다.
-- 8월 랭킹은 8월 종료 후(한국시간 9월 1일부터) finalized=true가 된 뒤에만 인정됩니다.

create or replace function public.block_prelaunch_monthly_ranking()
returns trigger
language plpgsql
as $$
begin
  if new.month < date '2026-08-01' then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_prelaunch_monthly_ranking
on public.monthly_ranking_history;

create trigger trg_block_prelaunch_monthly_ranking
before insert or update of month on public.monthly_ranking_history
for each row execute function public.block_prelaunch_monthly_ranking();

-- 서비스 시작 전(7월 이전 포함) 랭킹 기록은 운영 랭킹에서 제외합니다.
delete from public.monthly_ranking_history
where month < date '2026-08-01';

-- 현재 왕의 무게 보유자 중 2026-08 이후의 정상 확정 1위 기록이 없는 학생에게
-- 잘못 지급된 엠블럼 보상 XP만 되돌립니다.
with invalid_king_users as (
  select se.user_id
  from public.student_emblems se
  where se.emblem_id = 'achievement_king'
    and not exists (
      select 1
      from public.monthly_ranking_history mrh
      where mrh.user_id = se.user_id
        and mrh.month >= date '2026-08-01'
        and mrh.rank = 1
        and mrh.finalized = true
        and (
          (mrh.winner_grade_group = 'middle' and mrh.category = 'middle')
          or
          (mrh.winner_grade_group = 'high' and mrh.category in ('high','csat'))
        )
    )
), revoke_xp as (
  select el.user_id, sum(el.earned_xp)::integer as xp
  from public.experience_logs el
  join invalid_king_users iku on iku.user_id = el.user_id
  where el.payout_key = 'emblem:' || el.user_id::text || ':achievement_king'
  group by el.user_id
)
update public.student_experience se
set total_xp = greatest(0, se.total_xp - rx.xp),
    updated_at = now()
from revoke_xp rx
where se.user_id = rx.user_id;

-- 경험치 원복 후 레벨과 칭호도 현재 누적 XP에 맞게 재계산합니다.
update public.student_experience se
set level = coalesce((
      select ls.level
      from public.level_settings ls
      where ls.required_xp <= se.total_xp
      order by ls.level desc
      limit 1
    ), 1),
    title = coalesce((
      select ls.title
      from public.level_settings ls
      where ls.required_xp <= se.total_xp
      order by ls.level desc
      limit 1
    ), '단어병아리'),
    updated_at = now();

with invalid_king_users as (
  select se.user_id
  from public.student_emblems se
  where se.emblem_id = 'achievement_king'
    and not exists (
      select 1
      from public.monthly_ranking_history mrh
      where mrh.user_id = se.user_id
        and mrh.month >= date '2026-08-01'
        and mrh.rank = 1
        and mrh.finalized = true
        and (
          (mrh.winner_grade_group = 'middle' and mrh.category = 'middle')
          or
          (mrh.winner_grade_group = 'high' and mrh.category in ('high','csat'))
        )
    )
)
delete from public.experience_logs el
using invalid_king_users iku
where el.user_id = iku.user_id
  and el.payout_key = 'emblem:' || el.user_id::text || ':achievement_king';

-- 잘못 지급된 왕의 무게 자체를 회수합니다.
delete from public.student_emblems se
where se.emblem_id = 'achievement_king'
  and not exists (
    select 1
    from public.monthly_ranking_history mrh
    where mrh.user_id = se.user_id
      and mrh.month >= date '2026-08-01'
      and mrh.rank = 1
      and mrh.finalized = true
      and (
        (mrh.winner_grade_group = 'middle' and mrh.category = 'middle')
        or
        (mrh.winner_grade_group = 'high' and mrh.category in ('high','csat'))
      )
  );
