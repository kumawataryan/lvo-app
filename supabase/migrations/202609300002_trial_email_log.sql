-- Trials have no purchase row, so their emails are logged per user. Written only by the server.
create table public.trial_email_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  email_key text not null check (email_key in ('trial_started', 'trial_ending_7d', 'trial_ending_1d', 'trial_ended')),
  sent_at timestamptz not null default now(),
  primary key (user_id, email_key)
);

alter table public.trial_email_log enable row level security;
revoke all on table public.trial_email_log from anon, authenticated;
