create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  minimum_age smallint,
  maximum_age smallint,
  -- Bucket-relative paths inside the public `games` storage bucket.
  html_path text not null,
  featured_image_path text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (minimum_age is null and maximum_age is null)
    or (minimum_age between 0 and 18 and maximum_age between minimum_age and 18)
  )
);

create index games_published_order_idx
on public.games (sort_order, published_at desc)
where status = 'published';

create index games_tags_idx on public.games using gin (tags);

create trigger games_set_updated_at before update on public.games
for each row execute function public.set_updated_at();

alter table public.games enable row level security;

revoke all on table public.games from anon, authenticated;
grant select on table public.games to anon, authenticated;
grant insert, update, delete on table public.games to authenticated;

create policy "Published games are public" on public.games
for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());

create policy "Contributors can read all games" on public.games
for select to authenticated using (public.can_manage_templates());
create policy "Contributors can create games" on public.games
for insert to authenticated with check (public.can_manage_templates());
create policy "Contributors can update games" on public.games
for update to authenticated using (public.can_manage_templates()) with check (public.can_manage_templates());
create policy "Contributors can delete games" on public.games
for delete to authenticated using (public.can_manage_templates());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('games', 'games', true, 20971520, array['text/html', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Game files are publicly readable" on storage.objects
for select to anon, authenticated using (bucket_id = 'games');
create policy "Contributors can upload game files" on storage.objects
for insert to authenticated with check (bucket_id = 'games' and public.can_manage_templates());
create policy "Contributors can update game files" on storage.objects
for update to authenticated using (bucket_id = 'games' and public.can_manage_templates())
with check (bucket_id = 'games' and public.can_manage_templates());
create policy "Contributors can delete game files" on storage.objects
for delete to authenticated using (bucket_id = 'games' and public.can_manage_templates());
