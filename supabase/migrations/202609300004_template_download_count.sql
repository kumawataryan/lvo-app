-- Total successful downloads per template, shown on the template page.
alter table public.templates add column if not exists download_count integer not null default 0;

-- Atomic increment so concurrent downloads aren't lost. Callable by the server only.
create or replace function public.increment_template_download(p_template_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.templates set download_count = download_count + 1 where id = p_template_id;
$$;

revoke all on function public.increment_template_download(uuid) from public, anon, authenticated;
grant execute on function public.increment_template_download(uuid) to service_role;
