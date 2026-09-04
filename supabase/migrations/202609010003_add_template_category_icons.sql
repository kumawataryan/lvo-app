alter table public.template_categories
add column icon text not null default 'shapes';

update public.template_categories
set icon = case slug
  when 'diy' then 'hammer'
  when 'coloring' then 'palette'
  when 'activities' then 'puzzle'
  when 'drawing' then 'pencil'
  when 'worksheets' then 'clipboard-list'
  when 'craft-classes' then 'graduation-cap'
  when 'stories' then 'book-open'
  else icon
end;
