-- Restored from the applied Supabase migration history.
-- School assessment vocabulary books assigned by teachers to students.

create table if not exists public.school_vocab_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  school_name text not null default '',
  grade_label text not null default '',
  description text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_vocab_words (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.school_vocab_books(id) on delete cascade,
  position integer not null,
  word text not null,
  meaning text not null,
  example text not null default '',
  translation text not null default '',
  created_at timestamptz not null default now(),
  unique(book_id, position)
);

create table if not exists public.school_vocab_assignments (
  book_id uuid not null references public.school_vocab_books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key(book_id, user_id)
);

create table if not exists public.school_vocab_test_results (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.school_vocab_books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_type text not null default 'mixed',
  question_count integer not null default 0,
  correct_count integer not null default 0,
  score numeric not null default 0,
  wrong_words jsonb not null default '[]'::jsonb,
  taken_at timestamptz not null default now()
);

create index if not exists school_vocab_words_book_idx
on public.school_vocab_words(book_id, position);

create index if not exists school_vocab_assignments_user_idx
on public.school_vocab_assignments(user_id, assigned_at desc);

create index if not exists school_vocab_test_results_user_idx
on public.school_vocab_test_results(user_id, taken_at desc);

alter table public.school_vocab_books enable row level security;
alter table public.school_vocab_words enable row level security;
alter table public.school_vocab_assignments enable row level security;
alter table public.school_vocab_test_results enable row level security;
