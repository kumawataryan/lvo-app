alter table public.purchases
add column if not exists gateway text not null default 'razorpay' check (gateway in ('razorpay', 'paypal', 'etsy')),
add column if not exists paypal_order_id text unique,
add column if not exists paypal_subscription_id text unique,
add column if not exists external_reference text;

create index if not exists purchases_gateway_idx on public.purchases (gateway, status);
