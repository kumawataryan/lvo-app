-- Seed five child categories beneath each template root category.

with subcategories(parent_slug, name, slug, sort_order) as (
  values
    ('diy', 'Paper', 'diy-paper', 10),
    ('diy', 'Clay', 'diy-clay', 20),
    ('diy', 'Recycled', 'diy-recycled', 30),
    ('diy', 'Decor', 'diy-decor', 40),
    ('diy', 'Gifts', 'diy-gifts', 50),

    ('coloring', 'Animals', 'coloring-animals', 10),
    ('coloring', 'Nature', 'coloring-nature', 20),
    ('coloring', 'Mandalas', 'coloring-mandalas', 30),
    ('coloring', 'Fantasy', 'coloring-fantasy', 40),
    ('coloring', 'Seasonal', 'coloring-seasonal', 50),

    ('activities', 'Indoor', 'activities-indoor', 10),
    ('activities', 'Outdoor', 'activities-outdoor', 20),
    ('activities', 'STEM', 'activities-stem', 30),
    ('activities', 'Sensory', 'activities-sensory', 40),
    ('activities', 'Group', 'activities-group', 50),

    ('drawing', 'Animals', 'drawing-animals', 10),
    ('drawing', 'People', 'drawing-people', 20),
    ('drawing', 'Nature', 'drawing-nature', 30),
    ('drawing', 'Cartoons', 'drawing-cartoons', 40),
    ('drawing', 'Objects', 'drawing-objects', 50),

    ('worksheets', 'Math', 'worksheets-math', 10),
    ('worksheets', 'Literacy', 'worksheets-literacy', 20),
    ('worksheets', 'Science', 'worksheets-science', 30),
    ('worksheets', 'Tracing', 'worksheets-tracing', 40),
    ('worksheets', 'Puzzles', 'worksheets-puzzles', 50)
)
insert into public.template_categories (
  name,
  slug,
  parent_id,
  sort_order,
  is_active
)
select
  subcategories.name,
  subcategories.slug,
  parents.id,
  subcategories.sort_order,
  true
from subcategories
join public.template_categories as parents
  on parents.slug = subcategories.parent_slug
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  sort_order = excluded.sort_order,
  is_active = true;
