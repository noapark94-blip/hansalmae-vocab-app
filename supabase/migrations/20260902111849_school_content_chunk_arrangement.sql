-- 학교 내신 본문 청크 배열 및 어형 변형 학습
-- 모든 읽기/쓰기는 인증을 검증하는 school-vocab Edge Function을 통해서만 수행합니다.

create table if not exists public.school_content_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  school_name text not null default '',
  grade_label text not null default '',
  textbook text not null default '',
  unit_label text not null default '',
  description text not null default '',
  sentences jsonb not null default '[]'::jsonb,
  sentence_count integer not null default 0 check (sentence_count between 0 and 300),
  created_by uuid references public.profiles(id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_content_books_sentences_array
    check (jsonb_typeof(sentences) = 'array')
);

create table if not exists public.school_content_assignments (
  book_id uuid not null references public.school_content_books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create table if not exists public.school_content_results (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.school_content_books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sentence_count integer not null default 0,
  sentence_correct_count integer not null default 0,
  order_correct_count integer not null default 0,
  morph_correct_count integer not null default 0,
  score numeric not null default 0,
  details jsonb not null default '[]'::jsonb,
  taken_at timestamptz not null default now(),
  constraint school_content_results_details_array
    check (jsonb_typeof(details) = 'array')
);

create index if not exists school_content_assignments_user_idx
on public.school_content_assignments(user_id, assigned_at desc);

create index if not exists school_content_books_created_by_idx
on public.school_content_books(created_by)
where created_by is not null;

create index if not exists school_content_results_user_idx
on public.school_content_results(user_id, taken_at desc);

create index if not exists school_content_results_book_idx
on public.school_content_results(book_id, taken_at desc);

alter table public.school_content_books enable row level security;
alter table public.school_content_assignments enable row level security;
alter table public.school_content_results enable row level security;

revoke all on table public.school_content_books from anon, authenticated;
revoke all on table public.school_content_assignments from anon, authenticated;
revoke all on table public.school_content_results from anon, authenticated;

grant select, insert, update, delete on table public.school_content_books to service_role;
grant select, insert, update, delete on table public.school_content_assignments to service_role;
grant select, insert, update, delete on table public.school_content_results to service_role;

comment on table public.school_content_books is
'학교 내신 본문과 문장별 청크·어형 변형 정답. school-vocab Edge Function에서만 관리합니다.';
comment on table public.school_content_results is
'학생의 본문 청크 배열 및 어형 변형 연습 결과.';
