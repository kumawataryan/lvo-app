create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('monthly', 'yearly', 'lifetime')),
  billing_type text not null check (billing_type in ('subscription', 'one_time')),
  status text not null default 'created' check (
    status in ('created', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'failed')
  ),
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  razorpay_customer_id text,
  razorpay_subscription_id text unique,
  razorpay_order_id text unique,
  razorpay_payment_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchases_user_created_idx on public.purchases (user_id, created_at desc);

create trigger purchases_set_updated_at before update on public.purchases
for each row execute function public.set_updated_at();

alter table public.purchases enable row level security;

grant select, insert on public.purchases to authenticated;

create policy "Users read their purchases" on public.purchases
for select to authenticated
using (user_id = auth.uid());

create policy "Users create their purchases" on public.purchases
for insert to authenticated
with check (user_id = auth.uid());
