-- Only the server-side admin API can read or change the invitation code.
create table public.signup_code_settings (
  id boolean primary key default true check (id),
  code text not null check (code ~ '^[A-Z0-9]{6,8}$'),
  revision uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.signup_code_settings enable row level security;
revoke all on public.signup_code_settings from public, anon, authenticated;
grant select, insert, update on public.signup_code_settings to service_role;
