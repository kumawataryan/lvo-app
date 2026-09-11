create extension if not exists pg_trgm with schema extensions;

alter table public.templates
add column if not exists search_vector tsvector generated always as (to_tsvector('simple', search_text)) stored;

create index if not exists templates_search_vector_idx
on public.templates using gin (search_vector)
where status = 'published';

create or replace function public.search_published_templates(
  search_query text,
  result_limit integer default 50,
  category_slug text default null,
  featured_only boolean default null
)
returns table (template_id uuid, relevance real)
language sql
stable
security invoker
set search_path = pg_catalog, extensions, public
as $$
  with normalized as (
    select lower(trim(regexp_replace(search_query, '[^[:alnum:] ]+', ' ', 'g'))) as query
  ),
  terms as (
    select distinct term
    from normalized, lateral regexp_split_to_table(query, '\s+') as term
    where char_length(term) > 0
    limit 8
  )
  select
    templates.id,
    (
      ts_rank_cd(templates.search_vector, websearch_to_tsquery('simple', normalized.query)) * 6
      + greatest(similarity(templates.search_text, normalized.query), word_similarity(normalized.query, templates.search_text))
      + coalesce((select avg(word_similarity(terms.term, templates.search_text)) from terms), 0)
    )::real as relevance
  from public.templates
  cross join normalized
  where templates.status = 'published'
    and templates.published_at is not null
    and templates.published_at <= now()
    and (featured_only is null or templates.is_featured = featured_only)
    and (
      category_slug is null
      or exists (
        select 1
        from public.template_category_assignments assignments
        join public.template_categories categories on categories.id = assignments.category_id
        where assignments.template_id = templates.id and categories.slug = category_slug
      )
    )
    and normalized.query <> ''
    and not exists (
      select 1 from terms
      where not (
        templates.search_vector @@ plainto_tsquery('simple', terms.term)
        or terms.term <% templates.search_text
      )
    )
  order by relevance desc, templates.sort_order, templates.published_at desc
  limit least(greatest(result_limit, 1), 100);
$$;

grant execute on function public.search_published_templates(text, integer, text, boolean) to anon, authenticated;
