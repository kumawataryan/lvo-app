-- Replace the existing category catalog with the approved root categories.
-- Existing templates are retained and reassigned to DIY.

insert into public.template_categories (name, slug, parent_id, sort_order, is_active)
values
  ('DIY', 'diy', null, 10, true),
  ('Coloring', 'coloring', null, 20, true),
  ('Activities', 'activities', null, 30, true),
  ('Drawing', 'drawing', null, 40, true),
  ('Worksheets', 'worksheets', null, 50, true),
  ('Craft Classes', 'craft-classes', null, 60, true),
  ('Stories', 'stories', null, 70, true)
on conflict (slug) do update set
  name = excluded.name,
  parent_id = null,
  sort_order = excluded.sort_order,
  is_active = true;

-- Category rows cannot be deleted while assignments reference them. Replace all
-- existing assignments with one primary DIY assignment per template first.
delete from public.template_category_assignments;

insert into public.template_category_assignments (
  template_id,
  category_id,
  is_primary,
  sort_order
)
select templates.id, categories.id, true, 0
from public.templates as templates
cross join public.template_categories as categories
where categories.slug = 'diy';

delete from public.template_categories
where slug not in (
  'diy',
  'coloring',
  'activities',
  'drawing',
  'worksheets',
  'craft-classes',
  'stories'
);
