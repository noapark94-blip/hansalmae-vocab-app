-- 한국시간 출석 기록과 원본 엠블럼 이미지 설정 복원
create table if not exists public.student_daily_activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

alter table public.student_daily_activity enable row level security;

drop policy if exists student_daily_activity_read on public.student_daily_activity;
create policy student_daily_activity_read
on public.student_daily_activity for select
using (user_id = auth.uid() or public.is_staff());

-- 이전 시험 응시일도 한국시간 기준 활동일로 보존합니다.
insert into public.student_daily_activity(user_id, activity_date, last_seen_at)
select user_id, (taken_at at time zone 'Asia/Seoul')::date, max(taken_at)
from public.test_results
group by user_id, (taken_at at time zone 'Asia/Seoul')::date
on conflict(user_id, activity_date) do update
set last_seen_at = greatest(public.student_daily_activity.last_seen_at, excluded.last_seen_at);

insert into public.emblem_settings
  (id,name,image_path,condition_type,condition_value,sort_order,enabled)
values
 ('title_chick','단어병아리','./images/emblems/title-chick.png','LEVEL','1',1,true),
 ('title_collector','단어수집가','./images/emblems/title-collector.png','LEVEL','5',2,true),
 ('title_predator','단어 포식자','./images/emblems/title-predator.png','LEVEL','10',3,true),
 ('title_holic','단어 홀릭','./images/emblems/title-holic.png','LEVEL','15',4,true),
 ('title_slayer','단어 학살자','./images/emblems/title-slayer.png','LEVEL','20',5,true),
 ('title_madman','맑은 눈의 단어광인','./images/emblems/title-madman.png','LEVEL','25',6,true),
 ('title_dictionary','WALKING DICTIONARY','./images/emblems/title-dictionary.png','LEVEL','30',7,true),
 ('achievement_king','왕의 무게','./images/emblems/achievement-king.png','MONTHLY_RANK_1','1',8,true),
 ('achievement_success','뭘 해도 성공할 놈','./images/emblems/achievement-success.png','ATTENDANCE_STREAK','7',9,true),
 ('achievement_madness_max','광기 MAX','./images/emblems/achievement-madness-max.png','PERFECT_STREAK','10',10,true),
 ('achievement_conqueror','정복자','./images/emblems/achievement-conqueror.png','CONSECUTIVE_MONTHLY_RANK_1','2',11,true),
 ('achievement_teacher_blessing','T의 가호를 받은 자','./images/emblems/achievement-teacher-blessing.png','TEACHER_TEST_COUNT','15',12,true),
 ('achievement_reborn','다시 태어나','./images/emblems/achievement-reborn.png','ZERO_CORRECT_COUNT','3',13,true),
 ('achievement_vocab_trainer','단어 도감 트레이너','./images/emblems/achievement-vocab-trainer.png','VOCABULARY_BOOK_COUNT','2',14,true),
 ('achievement_wrong_hunter','오답 사냥꾼','./images/emblems/achievement-wrong-hunter.png','WRONG_NOTEBOOK_COUNT','30',15,true)
on conflict(id) do update set
  name=excluded.name,
  image_path=excluded.image_path,
  condition_type=excluded.condition_type,
  condition_value=excluded.condition_value,
  sort_order=excluded.sort_order,
  enabled=excluded.enabled;
