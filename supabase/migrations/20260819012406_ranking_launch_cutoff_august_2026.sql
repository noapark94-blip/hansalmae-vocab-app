-- Restored from the applied Supabase migration history.
-- Ranking and ranking emblems launch from 2026-08-01.

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

delete from public.monthly_ranking_history
where month < date '2026-08-01';

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
