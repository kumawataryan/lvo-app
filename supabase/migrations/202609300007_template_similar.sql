-- Templates an author picked as similar to this one. They show first in the related grid.
create table public.template_similar (
  template_id uuid not null references public.templates(id) on delete cascade,
  similar_template_id uuid not null references public.templates(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (template_id, similar_template_id),
  check (template_id <> similar_template_id)
);

create index template_similar_order_idx on public.template_similar (template_id, sort_order);

alter table public.template_similar enable row level security;
revoke all on table public.template_similar from anon, authenticated;
grant select on table public.template_similar to anon, authenticated;
grant insert, update, delete on table public.template_similar to authenticated;

create policy "Published template similar links are public" on public.template_similar
for select to anon, authenticated
using (
  exists (
    select 1 from public.templates
    where templates.id = template_similar.template_id
      and templates.status = 'published'
      and templates.published_at <= now()
  )
);

create policy "Contributors manage template similar links" on public.template_similar
for all to authenticated
using (public.can_manage_templates())
with check (public.can_manage_templates());
