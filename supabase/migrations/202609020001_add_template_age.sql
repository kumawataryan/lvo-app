alter table public.templates
add column age smallint;

alter table public.templates
add constraint templates_age_valid
check (age is null or age between 0 and 18);

create index templates_age_idx
on public.templates (age)
where status = 'published' and age is not null;
