alter table public.templates
add column if not exists is_free boolean not null default false;

comment on column public.templates.is_free is
'Allows downloading the printable without an active subscription.';

update public.templates
set is_free = true
where slug = 'paper-flower-bouquet';
