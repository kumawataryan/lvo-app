create table public.craft_classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'video' check (kind in ('video', 'playlist')),
  youtube_url text not null check (youtube_url ~ '^https://(www\.)?(youtube\.com|youtu\.be)/'),
  playlist_id text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'playlist' and playlist_id is not null) or (kind = 'video' and playlist_id is null))
);

create index craft_classes_published_order_idx
on public.craft_classes (sort_order, published_at desc)
where status = 'published';

create trigger craft_classes_set_updated_at before update on public.craft_classes
for each row execute function public.set_updated_at();

alter table public.craft_classes enable row level security;

revoke all on table public.craft_classes from anon, authenticated;
grant select on table public.craft_classes to anon, authenticated;
grant insert, update, delete on table public.craft_classes to authenticated;

create policy "Published craft classes are public" on public.craft_classes
for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());

create policy "Contributors can create craft classes" on public.craft_classes
for insert to authenticated with check (public.can_manage_templates());
create policy "Contributors can update craft classes" on public.craft_classes
for update to authenticated using (public.can_manage_templates()) with check (public.can_manage_templates());
create policy "Contributors can delete craft classes" on public.craft_classes
for delete to authenticated using (public.can_manage_templates());

insert into public.craft_classes (slug, title, kind, youtube_url, playlist_id, status, sort_order, published_at)
values
  ('back-to-school-crafts', 'Creative Back to School Crafts for Kids', 'video', 'https://www.youtube.com/watch?v=wFkJw_hqWSg', null, 'published', 10, now()),
  ('teacher-gifts-school-crafts', 'DIY Teacher Gifts & School Crafts', 'video', 'https://www.youtube.com/watch?v=8N381srQEYw', null, 'published', 20, now()),
  ('summer-craft-compilation', 'The Ultimate Summer Craft Compilation', 'video', 'https://www.youtube.com/watch?v=efLHLVGIOAE', null, 'published', 30, now()),
  ('rainbow-windmill-race-car', 'Rainbow Windmill + Paper Race Car Challenge', 'video', 'https://www.youtube.com/watch?v=U7yY9hNsthw', null, 'published', 40, now()),
  ('halloween-crafts-playlist', 'Halloween Crafts for Kids: Spooky, Silly & Creative Projects!', 'playlist', 'https://www.youtube.com/watch?v=Unx0a3yL7oA&list=PLb17r1kZH4X0D3rmOgJ0t_x_9uMT6fLDP', 'PLb17r1kZH4X0D3rmOgJ0t_x_9uMT6fLDP', 'published', 50, now())
on conflict (slug) do nothing;
