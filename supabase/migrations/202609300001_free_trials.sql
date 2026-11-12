-- One row per free template a user has downloaded (used to decide who qualifies for a free trial).
create table public.template_downloads (
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);

-- A one-month free trial. The primary key means each user can only ever claim one.
create table public.free_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.template_downloads enable row level security;
alter table public.free_trials enable row level security;

revoke all on table public.template_downloads, public.free_trials from anon, authenticated;
grant select on table public.template_downloads, public.free_trials to authenticated;

create policy "Users read their own downloads" on public.template_downloads
for select to authenticated
using (user_id = auth.uid());

create policy "Users read their own trial" on public.free_trials
for select to authenticated
using (user_id = auth.uid());
