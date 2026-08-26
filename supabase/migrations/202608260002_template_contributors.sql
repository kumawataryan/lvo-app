alter table public.templates
add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists templates_created_by_idx on public.templates (created_by);

create or replace function public.can_manage_templates()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'can_add_templates')::boolean, false)
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'template_editor');
$$;

revoke all on function public.can_manage_templates() from public, anon;
grant execute on function public.can_manage_templates() to authenticated;

grant insert, update, delete on table public.templates, public.template_gallery_images, public.supplies, public.template_supplies to authenticated;

create policy "Contributors can create templates" on public.templates
for insert to authenticated
with check (public.can_manage_templates() and created_by = auth.uid());

create policy "Contributors can update templates" on public.templates
for update to authenticated
using (public.can_manage_templates())
with check (public.can_manage_templates());

create policy "Contributors can delete templates" on public.templates
for delete to authenticated
using (public.can_manage_templates());

create policy "Contributors can create gallery images" on public.template_gallery_images
for insert to authenticated
with check (public.can_manage_templates());

create policy "Contributors can manage gallery images" on public.template_gallery_images
for update to authenticated
using (public.can_manage_templates())
with check (public.can_manage_templates());

create policy "Contributors can delete gallery images" on public.template_gallery_images
for delete to authenticated
using (public.can_manage_templates());

create policy "Contributors can create supplies" on public.supplies
for insert to authenticated
with check (public.can_manage_templates());

create policy "Contributors can link supplies" on public.template_supplies
for insert to authenticated
with check (public.can_manage_templates());

create policy "Contributors can manage template supplies" on public.template_supplies
for update to authenticated
using (public.can_manage_templates())
with check (public.can_manage_templates());

create policy "Contributors can delete template supplies" on public.template_supplies
for delete to authenticated
using (public.can_manage_templates());

create policy "Contributors can upload template media" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'template-media'
  and public.can_manage_templates()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Contributors can remove their template media" on storage.objects
for delete to authenticated
using (
  bucket_id = 'template-media'
  and public.can_manage_templates()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Contributors can upload printables" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'template-printables'
  and public.can_manage_templates()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Contributors can remove their printables" on storage.objects
for delete to authenticated
using (
  bucket_id = 'template-printables'
  and public.can_manage_templates()
  and (storage.foldername(name))[1] = auth.uid()::text
);
