-- Affiliate products that admins manage and template authors pick from.
create table public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  short_name text not null check (char_length(short_name) between 1 and 30),
  -- Either a Supabase storage path in the template-media bucket, or a site path such as /affiliate/file.png.
  image_path text not null,
  affiliate_url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index affiliate_products_order_idx on public.affiliate_products (sort_order);

-- Which affiliate products a template shows.
create table public.template_affiliate_products (
  template_id uuid not null references public.templates(id) on delete cascade,
  affiliate_product_id uuid not null references public.affiliate_products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (template_id, affiliate_product_id)
);

create index template_affiliate_products_order_idx on public.template_affiliate_products (template_id, sort_order);

create trigger affiliate_products_set_updated_at
before update on public.affiliate_products
for each row execute function public.set_updated_at();

alter table public.affiliate_products enable row level security;
alter table public.template_affiliate_products enable row level security;

revoke all on table public.affiliate_products, public.template_affiliate_products from anon, authenticated;
grant select on table public.affiliate_products, public.template_affiliate_products to anon, authenticated;
grant insert, update, delete on table public.affiliate_products to authenticated;
grant insert, update, delete on table public.template_affiliate_products to authenticated;

create policy "Active affiliate products are public" on public.affiliate_products
for select to anon, authenticated
using (is_active);

create policy "Admins manage affiliate products" on public.affiliate_products
for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Published template affiliate links are public" on public.template_affiliate_products
for select to anon, authenticated
using (
  exists (
    select 1 from public.templates
    where templates.id = template_affiliate_products.template_id
      and templates.status = 'published'
      and templates.published_at <= now()
  )
);

create policy "Contributors manage template affiliate links" on public.template_affiliate_products
for all to authenticated
using (public.can_manage_templates())
with check (public.can_manage_templates());

-- The three products currently shown on template pages.
insert into public.affiliate_products (name, short_name, image_path, affiliate_url, sort_order) values
  ('Scotch Kids Scissors, 5 in', 'Scissors', '/affiliate/scotch-kids-scissors.png', '#', 10),
  ('150-Piece Art Set', 'Art Set', '/affiliate/art-set-150-piece.png', '#', 20),
  ('Themisto 40W Glue Gun', 'Glue Gun', '/affiliate/glue-gun-40w.png', '#', 30);
