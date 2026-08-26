create extension if not exists pgcrypto;

create table public.template_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.template_categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  short_description text not null default '' check (char_length(short_description) <= 280),
  duration_minutes smallint not null check (duration_minutes between 1 and 1440),
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'advanced')),
  video_path text not null,
  printable_path text,
  thumbnail_path text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.template_gallery_images (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (template_id, storage_path)
);

create table public.supplies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,
  created_at timestamptz not null default now()
);

create table public.template_supplies (
  template_id uuid not null references public.templates(id) on delete cascade,
  supply_id uuid not null references public.supplies(id) on delete restrict,
  quantity text,
  notes text,
  sort_order integer not null default 0,
  primary key (template_id, supply_id)
);

create index templates_published_order_idx on public.templates (sort_order, published_at desc) where status = 'published';
create index templates_category_idx on public.templates (category_id) where status = 'published';
create index gallery_template_order_idx on public.template_gallery_images (template_id, sort_order);
create index template_supplies_order_idx on public.template_supplies (template_id, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger template_categories_set_updated_at before update on public.template_categories
for each row execute function public.set_updated_at();
create trigger templates_set_updated_at before update on public.templates
for each row execute function public.set_updated_at();

alter table public.template_categories enable row level security;
alter table public.templates enable row level security;
alter table public.template_gallery_images enable row level security;
alter table public.supplies enable row level security;
alter table public.template_supplies enable row level security;

revoke all on table public.template_categories, public.templates, public.template_gallery_images, public.supplies, public.template_supplies from anon, authenticated;
grant select on table public.template_categories, public.templates, public.template_gallery_images, public.supplies, public.template_supplies to anon, authenticated;

create policy "Active categories are public" on public.template_categories for select to anon, authenticated using (is_active);
create policy "Published templates are public" on public.templates for select to anon, authenticated using (status = 'published' and published_at is not null and published_at <= now());
create policy "Published gallery images are public" on public.template_gallery_images for select to anon, authenticated using (
  exists (select 1 from public.templates where templates.id = template_gallery_images.template_id and templates.status = 'published' and templates.published_at <= now())
);
create policy "Supplies are public" on public.supplies for select to anon, authenticated using (true);
create policy "Published template supplies are public" on public.template_supplies for select to anon, authenticated using (
  exists (select 1 from public.templates where templates.id = template_supplies.template_id and templates.status = 'published' and templates.published_at <= now())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('template-media', 'template-media', true, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  ('template-printables', 'template-printables', false, 26214400, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Template media is publicly readable" on storage.objects for select to anon, authenticated
using (bucket_id = 'template-media');

insert into public.template_categories (name, slug, sort_order)
values
  ('Paper Crafts', 'paper-crafts', 10),
  ('DIY Decor', 'diy-decor', 20),
  ('Origami', 'origami', 30),
  ('Gifts', 'gifts', 40),
  ('Kids', 'kids', 50),
  ('Painting', 'painting', 60),
  ('Clay', 'clay', 70),
  ('Seasonal', 'seasonal', 80)
on conflict (slug) do nothing;

insert into public.supplies (name, icon)
values ('Colored paper', 'file-text'), ('Scissors', 'scissors'), ('Glue', 'droplets'), ('Pencil', 'pencil'), ('Ruler', 'ruler')
on conflict (name) do nothing;

with category as (select id from public.template_categories where slug = 'paper-crafts')
insert into public.templates (category_id, slug, title, short_description, duration_minutes, difficulty, video_path, printable_path, thumbnail_path, status, is_featured, sort_order, published_at)
select id, 'paper-flower-bouquet', 'Paper Flower Bouquet', 'A calm paper flower activity with clear, child-friendly steps.', 15, 'easy', 'paper-flower-bouquet/video.mp4', 'paper-flower-bouquet/printable.pdf', 'paper-flower-bouquet/cover.webp', 'published', true, 10, now()
from category
on conflict (slug) do nothing;

with selected_template as (select id from public.templates where slug = 'paper-flower-bouquet')
insert into public.template_gallery_images (template_id, storage_path, alt_text, sort_order)
select selected_template.id, image.storage_path, image.alt_text, image.sort_order
from selected_template
cross join (values
  ('paper-flower-bouquet/gallery-1.webp', 'Finished paper flower bouquet', 10),
  ('paper-flower-bouquet/gallery-2.webp', 'Paper flower pieces before assembly', 20),
  ('paper-flower-bouquet/gallery-3.webp', 'Completed bouquet held in a child’s hands', 30)
) as image(storage_path, alt_text, sort_order)
on conflict (template_id, storage_path) do nothing;

with selected_template as (select id from public.templates where slug = 'paper-flower-bouquet')
insert into public.template_supplies (template_id, supply_id, sort_order)
select selected_template.id, supplies.id, row_number() over (order by supplies.name)::integer * 10
from selected_template
cross join public.supplies
on conflict (template_id, supply_id) do nothing;
