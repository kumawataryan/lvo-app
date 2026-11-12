-- Label/value detail rows shown under "What you will get" on a template page.
create table public.template_specs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  value text not null check (char_length(value) between 1 and 200),
  sort_order integer not null default 0
);

create index template_specs_order_idx on public.template_specs (template_id, sort_order);

alter table public.template_specs enable row level security;

revoke all on table public.template_specs from anon, authenticated;
grant select on table public.template_specs to anon, authenticated;
grant insert, update, delete on table public.template_specs to authenticated;

create policy "Published template specs are public" on public.template_specs
for select to anon, authenticated
using (
  exists (
    select 1 from public.templates
    where templates.id = template_specs.template_id
      and templates.status = 'published'
      and templates.published_at <= now()
  )
);

create policy "Contributors can manage template specs" on public.template_specs
for all to authenticated
using (public.can_manage_templates())
with check (public.can_manage_templates());
