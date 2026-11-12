-- Emails collected in exchange for the free printable pack. Written only by the server.
create table public.email_leads (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  source text not null default 'homepage',
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table public.email_leads enable row level security;
revoke all on table public.email_leads from anon, authenticated;
