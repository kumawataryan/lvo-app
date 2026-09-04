alter table public.templates
add column minimum_age smallint,
add column maximum_age smallint;

-- Preserve any exact ages saved after the preceding migration.
update public.templates
set
  minimum_age = age,
  maximum_age = age
where age is not null;

alter table public.templates
add constraint templates_age_range_valid
check (
  (minimum_age is null and maximum_age is null)
  or (
    minimum_age between 0 and 18
    and maximum_age between minimum_age and 18
  )
);

drop index public.templates_age_idx;

alter table public.templates
drop constraint templates_age_valid,
drop column age;

create index templates_age_range_idx
on public.templates (minimum_age, maximum_age)
where status = 'published'
  and minimum_age is not null
  and maximum_age is not null;
