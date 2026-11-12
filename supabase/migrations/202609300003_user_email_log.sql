-- Account-level emails (such as the welcome email), logged once per user. Written only by the server.
create table public.user_email_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  email_key text not null check (email_key in ('welcome')),
  sent_at timestamptz not null default now(),
  primary key (user_id, email_key)
);

alter table public.user_email_log enable row level security;
revoke all on table public.user_email_log from anon, authenticated;
