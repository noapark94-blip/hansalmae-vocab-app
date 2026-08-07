-- 교사가 초기화한 임시 비밀번호는 첫 로그인 때 반드시 변경하도록 합니다.
alter table public.profiles
add column if not exists must_change_password boolean not null default false;

create index if not exists profiles_must_change_password_idx
on public.profiles(must_change_password)
where must_change_password = true;
