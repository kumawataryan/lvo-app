-- Records which lifecycle emails were sent for each purchase, so a reminder is never sent twice.
create table public.subscription_email_log (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  email_key text not null check (email_key in ('payment_failed', 'ending_7d', 'ending_1d', 'winback_30d', 'winback_60d')),
  sent_at timestamptz not null default now(),
  unique (purchase_id, email_key)
);

alter table public.subscription_email_log enable row level security;

-- Written and read only by the server (service role), so no grants to anon or authenticated.
revoke all on table public.subscription_email_log from anon, authenticated;
