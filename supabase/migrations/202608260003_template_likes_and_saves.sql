create table public.template_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);

create table public.template_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.template_collection_items (
  collection_id uuid not null references public.template_collections(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, template_id)
);

create index template_likes_user_created_idx on public.template_likes (user_id, created_at desc);
create index template_collections_user_created_idx on public.template_collections (user_id, created_at);
create index template_collection_items_template_idx on public.template_collection_items (template_id);

create trigger template_collections_set_updated_at before update on public.template_collections
for each row execute function public.set_updated_at();

alter table public.template_likes enable row level security;
alter table public.template_collections enable row level security;
alter table public.template_collection_items enable row level security;

grant select, insert, delete on public.template_likes, public.template_collections, public.template_collection_items to authenticated;

create policy "Users manage their likes" on public.template_likes
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users manage their collections" on public.template_collections
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users read their collection items" on public.template_collection_items
for select to authenticated
using (
  exists (
    select 1 from public.template_collections
    where template_collections.id = template_collection_items.collection_id
      and template_collections.user_id = auth.uid()
  )
);

create policy "Users add their collection items" on public.template_collection_items
for insert to authenticated
with check (
  exists (
    select 1 from public.template_collections
    where template_collections.id = template_collection_items.collection_id
      and template_collections.user_id = auth.uid()
  )
);

create policy "Users remove their collection items" on public.template_collection_items
for delete to authenticated
using (
  exists (
    select 1 from public.template_collections
    where template_collections.id = template_collection_items.collection_id
      and template_collections.user_id = auth.uid()
  )
);
