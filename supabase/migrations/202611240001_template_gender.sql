-- Optional audience gender for a template. Null means the template suits both boys and girls.

alter table public.templates
  add column if not exists gender text;

alter table public.templates
  drop constraint if exists templates_gender_check,
  add constraint templates_gender_check check (gender is null or gender in ('boy', 'girl'));
