-- 학생별 신규 기능 확인 상태를 저장합니다.
-- 학교 수행평가 NEW 배지는 학생이 카드를 처음 열었을 때만 이 테이블에 기록합니다.
create table if not exists public.student_feature_views (
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);

create index if not exists student_feature_views_feature_idx
on public.student_feature_views(feature_key, first_seen_at desc);

alter table public.student_feature_views enable row level security;

-- 브라우저에서 직접 접근하지 않고 service_role Edge Function을 통해서만 읽고 씁니다.
