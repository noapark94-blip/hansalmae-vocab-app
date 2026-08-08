-- 학생 계정당 활성 로그인 1개만 허용합니다.
create table if not exists public.student_active_sessions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists student_active_sessions_expires_at_idx
on public.student_active_sessions(expires_at);

alter table public.student_active_sessions enable row level security;

comment on table public.student_active_sessions is
'학생별 단일 활성 세션. service_role을 사용하는 Edge Function에서만 관리합니다.';
