create extension if not exists pg_trgm;

create table public.template_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.template_tag_assignments (
  template_id uuid not null references public.templates(id) on delete cascade,
  tag_id uuid not null references public.template_tags(id) on delete cascade,
  primary key (template_id, tag_id)
);

alter table public.templates add column search_text text not null default '';

create index template_tags_name_trgm_idx on public.template_tags using gin (name gin_trgm_ops);
create index template_tag_assignments_tag_idx on public.template_tag_assignments (tag_id, template_id);
create index templates_search_text_trgm_idx on public.templates using gin (search_text gin_trgm_ops) where status = 'published';

create or replace function public.refresh_template_search_text(template_id_input uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.templates
  set search_text = trim(concat_ws(' ',
    title,
    short_description,
    (select string_agg(tags.name, ' ' order by tags.name)
     from public.template_tag_assignments assignments
     join public.template_tags tags on tags.id = assignments.tag_id
     where assignments.template_id = template_id_input)
  ))
  where id = template_id_input;
$$;

create or replace function public.refresh_template_search_text_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_template_search_text(coalesce(new.template_id, old.template_id));
  return coalesce(new, old);
end;
$$;

create trigger template_tags_refresh_search_after_insert
after insert on public.template_tag_assignments
for each row execute function public.refresh_template_search_text_trigger();

create trigger template_tags_refresh_search_after_delete
after delete on public.template_tag_assignments
for each row execute function public.refresh_template_search_text_trigger();

create or replace function public.set_template_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.search_text = old.search_text then
    new.search_text := trim(concat_ws(' ', new.title, new.short_description,
      (select string_agg(tags.name, ' ' order by tags.name)
       from public.template_tag_assignments assignments
       join public.template_tags tags on tags.id = assignments.tag_id
       where assignments.template_id = new.id)
    ));
  end if;
  return new;
end;
$$;

create trigger templates_refresh_search_before_write
before insert or update of title, short_description on public.templates
for each row execute function public.set_template_search_text();

update public.templates set search_text = trim(concat_ws(' ', title, short_description));

alter table public.template_tags enable row level security;
alter table public.template_tag_assignments enable row level security;

revoke all on table public.template_tags, public.template_tag_assignments from anon, authenticated;
grant select on table public.template_tags, public.template_tag_assignments to anon, authenticated;
grant insert, update, delete on table public.template_tags, public.template_tag_assignments to authenticated;

create policy "Tags are publicly readable" on public.template_tags for select to anon, authenticated using (true);
create policy "Published template tags are publicly readable" on public.template_tag_assignments for select to anon, authenticated using (
  exists (select 1 from public.templates where templates.id = template_tag_assignments.template_id and templates.status = 'published' and templates.published_at <= now())
);
create policy "Template managers can create tags" on public.template_tags for insert to authenticated with check (public.can_manage_templates());
create policy "Template managers can update tags" on public.template_tags for update to authenticated using (public.can_manage_templates()) with check (public.can_manage_templates());
create policy "Template managers can delete tags" on public.template_tags for delete to authenticated using (public.can_manage_templates());
create policy "Template managers can assign tags" on public.template_tag_assignments for insert to authenticated with check (
  public.can_manage_templates() and exists (select 1 from public.templates where templates.id = template_tag_assignments.template_id and templates.created_by = auth.uid())
);
create policy "Template managers can remove tags" on public.template_tag_assignments for delete to authenticated using (
  public.can_manage_templates() and exists (select 1 from public.templates where templates.id = template_tag_assignments.template_id and templates.created_by = auth.uid())
);
