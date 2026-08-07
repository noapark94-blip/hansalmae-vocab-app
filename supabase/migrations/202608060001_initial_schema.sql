-- 한살매 단어앱: Google Sheets/App Script -> Supabase
create extension if not exists pgcrypto;

create type public.app_role as enum ('student', 'teacher', 'admin');
create type public.exam_status as enum ('draft', 'scheduled', 'active', 'closed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id text unique,
  display_name text not null,
  role public.app_role not null default 'student',
  base_grade text,
  base_year integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_id_required check (role <> 'student' or student_id is not null)
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.word_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.words (
  id bigint generated always as identity primary key,
  word_set_id uuid not null references public.word_sets(id) on delete cascade,
  day integer not null check (day > 0),
  word text not null,
  meaning text not null,
  example text not null default '',
  translation text not null default '',
  example_answer text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(word_set_id, day, word)
);
create index words_set_day_idx on public.words(word_set_id, day, sort_order);

create table public.exam_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid,
  scope_key text not null,
  progress jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, scope_key)
);

create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  taken_at timestamptz not null default now(),
  test_kind text not null default 'free',
  teacher_exam_id uuid,
  word_set_id uuid references public.word_sets(id),
  start_day integer,
  end_day integer,
  question_type text,
  question_count integer not null default 0,
  correct_count integer not null default 0,
  score numeric(6,2) not null default 0,
  grade text,
  points integer not null default 0,
  attempt integer not null default 1,
  highest_score_applied boolean not null default true,
  teacher_confirmed boolean not null default false,
  status text not null default 'completed',
  actual_day_counts jsonb not null default '{}'::jsonb,
  raw_result jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);
create index test_results_user_taken_idx on public.test_results(user_id, taken_at desc);
create index test_results_rank_idx on public.test_results(taken_at desc, points desc);

create table public.learning_activities (
  activity_key text primary key,
  occurred_at timestamptz not null default now(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_kind text not null,
  test_id uuid,
  word_set_id uuid references public.word_sets(id),
  days jsonb not null default '[]'::jsonb,
  score numeric(6,2) not null default 0,
  question_count integer not null default 0
);

create table public.wrong_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  word_set_id uuid references public.word_sets(id) on delete set null,
  day integer,
  word text not null,
  meaning text not null default '',
  example text not null default '',
  translation text not null default '',
  wrong_count integer not null default 1,
  first_wrong_at timestamptz not null default now(),
  last_wrong_at timestamptz not null default now(),
  mastered boolean not null default false,
  unique(user_id, word_set_id, day, word)
);
create index wrong_words_user_idx on public.wrong_words(user_id, mastered, last_wrong_at desc);

create table public.vocabulary_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_default_book_per_user on public.vocabulary_books(user_id) where is_default;

create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.vocabulary_books(id) on delete cascade,
  word_set_id uuid references public.word_sets(id) on delete set null,
  day integer,
  word text not null,
  meaning text not null default '',
  example text not null default '',
  translation text not null default '',
  mastered boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, book_id, word_set_id, day, word)
);
create index vocabulary_items_book_idx on public.vocabulary_items(book_id, created_at desc);

create table public.teacher_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null,
  word_set_id uuid references public.word_sets(id),
  start_day integer,
  end_day integer,
  question_count integer not null,
  question_type text not null,
  target_type text not null,
  target_value jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  passing_score integer not null default 60,
  allow_retake boolean not null default false,
  award_points boolean not null default true,
  status public.exam_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.test_results add constraint test_results_teacher_exam_fk
  foreign key (teacher_exam_id) references public.teacher_exams(id) on delete set null;
alter table public.exam_progress add constraint exam_progress_exam_fk
  foreign key (exam_id) references public.teacher_exams(id) on delete cascade;

create table public.teacher_exam_words (
  exam_id uuid not null references public.teacher_exams(id) on delete cascade,
  position integer not null,
  word_id bigint references public.words(id) on delete set null,
  source text not null default 'database',
  day integer,
  word text not null,
  meaning text not null,
  example text not null default '',
  translation text not null default '',
  enabled boolean not null default true,
  primary key(exam_id, position)
);

create table public.exam_assignments (
  exam_id uuid not null references public.teacher_exams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  notified boolean not null default false,
  notified_at timestamptz,
  status text not null default 'assigned',
  attempt integer not null default 0,
  highest_score numeric(6,2),
  completed_at timestamptz,
  teacher_confirmed boolean not null default false,
  primary key(exam_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid references public.teacher_exams(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.level_settings (
  level integer primary key check (level > 0),
  required_xp integer not null check (required_xp >= 0),
  title text not null
);

create table public.student_experience (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_xp integer not null default 0,
  level integer not null default 1,
  title text not null default '새싹 학습자',
  last_earned_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.experience_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_kind text,
  test_id uuid,
  range_key text,
  question_count integer not null default 0,
  score numeric(6,2) not null default 0,
  base_xp integer not null default 0,
  repeat_rate numeric(5,2) not null default 1,
  earned_xp integer not null,
  total_after integer not null,
  payout_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.bonus_xp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bonus_type text not null,
  xp integer not null,
  detail jsonb not null default '{}'::jsonb,
  payout_key text not null unique,
  total_after integer not null,
  created_at timestamptz not null default now()
);

create table public.emblem_settings (
  id text primary key,
  name text not null,
  image_path text not null,
  condition_type text not null,
  condition_value jsonb not null,
  sort_order integer not null default 0,
  enabled boolean not null default true
);

create table public.student_emblems (
  user_id uuid not null references public.profiles(id) on delete cascade,
  emblem_id text not null references public.emblem_settings(id) on delete cascade,
  earned_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key(user_id, emblem_id)
);
create unique index one_equipped_emblem_per_user on public.student_emblems(user_id) where equipped;

create table public.monthly_ranking_history (
  month date not null,
  word_set_id uuid references public.word_sets(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null,
  points integer not null,
  recorded_at timestamptz not null default now(),
  primary key(month, word_set_id, user_id)
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from profiles where id = auth.uid() and role in ('teacher','admin') and enabled) $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger books_touch before update on public.vocabulary_books for each row execute function public.touch_updated_at();
create trigger exams_touch before update on public.teacher_exams for each row execute function public.touch_updated_at();

-- 공개 스키마의 모든 테이블은 RLS로 보호한다.
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.word_sets enable row level security;
alter table public.words enable row level security;
alter table public.exam_progress enable row level security;
alter table public.test_results enable row level security;
alter table public.learning_activities enable row level security;
alter table public.wrong_words enable row level security;
alter table public.vocabulary_books enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.teacher_exams enable row level security;
alter table public.teacher_exam_words enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.notifications enable row level security;
alter table public.level_settings enable row level security;
alter table public.student_experience enable row level security;
alter table public.experience_logs enable row level security;
alter table public.bonus_xp_logs enable row level security;
alter table public.emblem_settings enable row level security;
alter table public.student_emblems enable row level security;
alter table public.monthly_ranking_history enable row level security;

create policy profile_self_read on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profile_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy catalog_read on public.word_sets for select to authenticated using (enabled or public.is_staff());
create policy words_read on public.words for select to authenticated using (true);
create policy levels_read on public.level_settings for select to authenticated using (true);
create policy emblems_read on public.emblem_settings for select to authenticated using (enabled or public.is_staff());

create policy progress_owner on public.exam_progress for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy results_owner_read on public.test_results for select using (user_id = auth.uid() or public.is_staff());
create policy activities_owner_read on public.learning_activities for select using (user_id = auth.uid() or public.is_staff());
create policy wrong_owner on public.wrong_words for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy books_owner on public.vocabulary_books for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy items_owner on public.vocabulary_items for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy assignments_owner_read on public.exam_assignments for select using (user_id = auth.uid() or public.is_staff());
create policy notifications_owner on public.notifications for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy xp_owner_read on public.student_experience for select using (user_id = auth.uid() or public.is_staff());
create policy xp_logs_owner_read on public.experience_logs for select using (user_id = auth.uid() or public.is_staff());
create policy bonus_logs_owner_read on public.bonus_xp_logs for select using (user_id = auth.uid() or public.is_staff());
create policy student_emblems_read on public.student_emblems for select using (user_id = auth.uid() or public.is_staff());
create policy rankings_authenticated_read on public.monthly_ranking_history for select to authenticated using (true);
create policy teacher_exams_assigned_read on public.teacher_exams for select using (public.is_staff() or exists(select 1 from public.exam_assignments a where a.exam_id=teacher_exams.id and a.user_id=auth.uid()));
create policy teacher_exam_words_assigned_read on public.teacher_exam_words for select using (public.is_staff() or exists(select 1 from public.exam_assignments a where a.exam_id=teacher_exam_words.exam_id and a.user_id=auth.uid()));

-- 쓰기는 Edge Function이 service role로 검증 후 수행한다. 브라우저에는 service role 키를 배포하지 않는다.
insert into public.level_settings(level, required_xp, title) values
  (1,0,'새싹 학습자'),(2,100,'꾸준한 학습자'),(3,300,'단어 탐험가'),
  (4,700,'어휘 전문가'),(5,1500,'단어 마스터') on conflict do nothing;

insert into public.app_settings(key,value) values
  ('experience', '{"minimumQuestions":10,"scoreRates":{"0":0,"60":0.6,"70":0.7,"80":0.8,"90":0.9,"100":1},"repeatRates":[1,0.5,0.25]}'),
  ('signup', '{"enabled":true}')
on conflict do nothing;
