-- One row per successful download, with its time, so we can rank templates by week or month.
create table public.template_download_events (
  id bigint generated always as identity primary key,
  template_id uuid not null references public.templates(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index template_download_events_time_idx on public.template_download_events (created_at, template_id);

alter table public.template_download_events enable row level security;
revoke all on table public.template_download_events from anon, authenticated;

-- Top templates by downloads since a given time. Only templates with at least one download are returned.
create or replace function public.get_top_downloaded_templates(p_since timestamptz, p_limit integer)
returns table (template_id uuid, downloads bigint)
language sql
security definer
set search_path = ''
as $$
  select e.template_id, count(*)::bigint as downloads
  from public.template_download_events e
  where e.created_at >= p_since
  group by e.template_id
  order by downloads desc
  limit p_limit;
$$;

revoke all on function public.get_top_downloaded_templates(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_top_downloaded_templates(timestamptz, integer) to service_role;
