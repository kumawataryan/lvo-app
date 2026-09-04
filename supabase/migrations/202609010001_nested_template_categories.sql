-- Support a category tree and multiple category assignments per template.

alter table public.template_categories
add column parent_id uuid references public.template_categories(id) on delete restrict;

alter table public.template_categories
add constraint template_categories_not_own_parent
check (parent_id is null or parent_id <> id);

create index template_categories_parent_order_idx
on public.template_categories (parent_id, sort_order);

-- Reject indirect cycles as well as direct self-references.
create or replace function public.prevent_template_category_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if exists (
    with recursive ancestors as (
      select category.id, category.parent_id
      from public.template_categories as category
      where category.id = new.parent_id

      union all

      select category.id, category.parent_id
      from public.template_categories as category
      join ancestors on category.id = ancestors.parent_id
    )
    select 1
    from ancestors
    where id = new.id
  ) then
    raise exception 'A template category cannot be its own ancestor.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_template_category_cycle() from public, anon, authenticated;

create trigger template_categories_prevent_cycle
before insert or update of parent_id on public.template_categories
for each row execute function public.prevent_template_category_cycle();

create table public.template_category_assignments (
  template_id uuid not null references public.templates(id) on delete cascade,
  category_id uuid not null references public.template_categories(id) on delete restrict,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (template_id, category_id)
);

create index template_category_assignments_category_idx
on public.template_category_assignments (category_id, template_id);

create unique index template_category_assignments_one_primary_idx
on public.template_category_assignments (template_id)
where is_primary;

-- Preserve the existing single category as each template's primary category.
insert into public.template_category_assignments (
  template_id,
  category_id,
  is_primary,
  sort_order
)
select id, category_id, true, 0
from public.templates;

alter table public.templates drop column category_id;

alter table public.template_category_assignments enable row level security;

revoke all on table public.template_category_assignments from anon, authenticated;
grant select on table public.template_category_assignments to anon, authenticated;
grant insert, update, delete on table public.template_category_assignments to authenticated;

create policy "Published template category assignments are public"
on public.template_category_assignments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.templates
    where templates.id = template_category_assignments.template_id
      and templates.status = 'published'
      and templates.published_at is not null
      and templates.published_at <= now()
  )
);

create policy "Contributors can link template categories"
on public.template_category_assignments
for insert
to authenticated
with check (public.can_manage_templates());

create policy "Contributors can update template categories"
on public.template_category_assignments
for update
to authenticated
using (public.can_manage_templates())
with check (public.can_manage_templates());

create policy "Contributors can unlink template categories"
on public.template_category_assignments
for delete
to authenticated
using (public.can_manage_templates());
