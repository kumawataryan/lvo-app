create or replace function public.delete_template_collection(collection_id_input uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  linked_kid public.kids%rowtype;
  replacement_name text;
  replacement_suffix integer := 2;
  replacement_collection_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.template_collections where id = collection_id_input and user_id = auth.uid()) then
    raise exception 'Collection not found';
  end if;

  select * into linked_kid from public.kids
  where collection_id = collection_id_input and user_id = auth.uid();

  if linked_kid.id is not null then
    replacement_name := left('For ' || linked_kid.name, 60);
    while exists (select 1 from public.template_collections where user_id = auth.uid() and lower(name) = lower(replacement_name) and id <> collection_id_input) loop
      replacement_name := left('For ' || linked_kid.name, 55) || ' (' || replacement_suffix || ')';
      replacement_suffix := replacement_suffix + 1;
    end loop;
    insert into public.template_collections (user_id, name) values (auth.uid(), replacement_name)
    returning id into replacement_collection_id;
    update public.kids set collection_id = replacement_collection_id where id = linked_kid.id;
  end if;

  delete from public.template_collections where id = collection_id_input and user_id = auth.uid();
end;
$$;

grant execute on function public.delete_template_collection(uuid) to authenticated;
