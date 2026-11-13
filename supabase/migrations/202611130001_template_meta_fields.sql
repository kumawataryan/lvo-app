-- SEO meta title and meta description for each template.
-- Empty values fall back to the template title and short description on the public page.

alter table public.templates
  add column if not exists meta_title text,
  add column if not exists meta_description text;

alter table public.templates
  drop constraint if exists templates_meta_title_length,
  add constraint templates_meta_title_length check (meta_title is null or char_length(meta_title) <= 70);

alter table public.templates
  drop constraint if exists templates_meta_description_length,
  add constraint templates_meta_description_length check (meta_description is null or char_length(meta_description) <= 180);
