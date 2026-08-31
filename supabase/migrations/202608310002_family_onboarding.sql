create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  parent_name text check (parent_name is null or char_length(parent_name) between 1 and 60),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kids (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  birth_year integer not null check (birth_year between 1920 and extract(year from current_date)::integer),
  avatar text not null check (avatar in ('fox', 'bear', 'bunny', 'lion', 'panda', 'frog', 'koala', 'cat', 'dog', 'owl', 'unicorn', 'dino')),
  collection_id uuid not null references public.template_collections(id) on delete restrict,
  sort_order smallint not null check (sort_order between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sort_order),
  unique (collection_id)
);

create index kids_user_id_idx on public.kids (user_id, sort_order);

create trigger user_profiles_set_updated_at before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger kids_set_updated_at before update on public.kids
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.kids enable row level security;

grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.kids to authenticated;
grant update on public.template_collections to authenticated;

create policy "Users manage their profile" on public.user_profiles
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage their kids" on public.kids
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.complete_family_onboarding(parent_name_input text, kids_input jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  kid jsonb;
  kid_count integer;
  kid_name text;
  collection_name text;
  collection_suffix integer;
  new_collection_id uuid;
  existing_kid_id uuid;
  existing_collection_id uuid;
  kept_kid_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(kids_input) <> 'array' then raise exception 'Kids must be an array'; end if;

  kid_count := jsonb_array_length(kids_input);
  if kid_count > 5 then raise exception 'A maximum of five kids is allowed'; end if;
  if nullif(btrim(parent_name_input), '') is not null and char_length(btrim(parent_name_input)) > 60 then
    raise exception 'Parent name is too long';
  end if;

  -- Older clients or interrupted loads may omit kid IDs. Recover them by their
  -- stable slot before deciding which rows were removed, preventing duplicate
  -- kids and collections when a parent saves Manage kids again.
  select coalesce(jsonb_agg(
    case
      when nullif(requested.value->>'id', '') is null and existing.id is not null
        then requested.value || jsonb_build_object('id', existing.id::text)
      else requested.value
    end order by requested.ordinality
  ), '[]'::jsonb)
  into kids_input
  from jsonb_array_elements(kids_input) with ordinality requested(value, ordinality)
  left join public.kids existing
    on existing.user_id = auth.uid()
   and existing.sort_order = (requested.value->>'sortOrder')::smallint;

  -- Delete removed rows before compacting sort positions. Their collections and
  -- saved craft items intentionally remain available in the library.
  delete from public.kids
  where user_id = auth.uid()
    and not exists (
      select 1 from jsonb_array_elements(kids_input) requested
      where requested->>'id' = kids.id::text
    );

  for kid in select value from jsonb_array_elements(kids_input)
  loop
    kid_name := btrim(kid->>'name');
    if kid_name = '' or char_length(kid_name) > 40 then raise exception 'Each kid needs a valid name'; end if;
    if (kid->>'birthYear')::integer not between 1920 and extract(year from current_date)::integer then
      raise exception 'Each kid needs a valid birth year';
    end if;
    if (kid->>'avatar') not in ('fox', 'bear', 'bunny', 'lion', 'panda', 'frog', 'koala', 'cat', 'dog', 'owl', 'unicorn', 'dino') then
      raise exception 'Each kid needs a valid avatar';
    end if;

    existing_kid_id := null;
    existing_collection_id := null;
    if nullif(kid->>'id', '') is not null then
      select id, collection_id into existing_kid_id, existing_collection_id
      from public.kids where id = (kid->>'id')::uuid and user_id = auth.uid();
    end if;

    collection_name := left('For ' || kid_name, 60);
    collection_suffix := 2;
    while exists (select 1 from public.template_collections where user_id = auth.uid() and lower(name) = lower(collection_name) and id is distinct from existing_collection_id) loop
      collection_name := left('For ' || kid_name, 55) || ' (' || collection_suffix || ')';
      collection_suffix := collection_suffix + 1;
    end loop;

    if existing_kid_id is not null then
      update public.template_collections set name = collection_name where id = existing_collection_id;
      update public.kids set name = kid_name, birth_year = (kid->>'birthYear')::integer,
        avatar = kid->>'avatar', sort_order = (kid->>'sortOrder')::smallint
      where id = existing_kid_id;
      kept_kid_ids := array_append(kept_kid_ids, existing_kid_id);
    else
      insert into public.template_collections (user_id, name)
      values (auth.uid(), collection_name)
      returning id into new_collection_id;

      insert into public.kids (user_id, name, birth_year, avatar, collection_id, sort_order)
      values (auth.uid(), kid_name, (kid->>'birthYear')::integer, kid->>'avatar', new_collection_id, (kid->>'sortOrder')::smallint)
      returning id into existing_kid_id;
      kept_kid_ids := array_append(kept_kid_ids, existing_kid_id);
    end if;
  end loop;

  -- Removing a kid never deletes their collection or its saved crafts.
  delete from public.kids where user_id = auth.uid() and not (id = any(kept_kid_ids));

  insert into public.user_profiles (user_id, parent_name, onboarding_completed_at)
  values (auth.uid(), nullif(btrim(parent_name_input), ''), now())
  on conflict (user_id) do update set
    parent_name = excluded.parent_name,
    onboarding_completed_at = excluded.onboarding_completed_at;
end;
$$;

grant execute on function public.complete_family_onboarding(text, jsonb) to authenticated;
