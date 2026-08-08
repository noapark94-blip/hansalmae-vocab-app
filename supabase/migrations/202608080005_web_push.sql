-- 설치형 웹앱(PWA) 푸시 구독 정보
create table if not exists public.student_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text
);

create index if not exists student_push_subscriptions_user_idx
on public.student_push_subscriptions(user_id,enabled);

alter table public.student_push_subscriptions enable row level security;

comment on table public.student_push_subscriptions is
'학생이 설치한 PWA 기기의 Web Push 구독. Edge Function에서만 관리합니다.';
