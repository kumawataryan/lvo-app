alter table public.purchases drop constraint if exists purchases_gateway_check;

alter table public.purchases
add constraint purchases_gateway_check
check (gateway in ('razorpay', 'paypal', 'stripe', 'etsy'));
