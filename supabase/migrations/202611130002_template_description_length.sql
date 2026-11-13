-- Raise the template description limit from 280 to 400 characters.
-- The original column check was unnamed, so Postgres called it templates_short_description_check.

alter table public.templates
  drop constraint if exists templates_short_description_check,
  add constraint templates_short_description_check check (char_length(short_description) <= 400);
