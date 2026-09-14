-- The templates table already supports draft/published/archived status
-- (default 'draft', see 202608260001_templates_backend.sql). This backfills
-- every template that predates that workflow to 'published' so existing
-- content stays visible; any template inserted elsewhere without an explicit
-- status continues to land as 'draft' by the column's own default.
update public.templates
set
  status = 'published',
  published_at = coalesce(published_at, now())
where status is distinct from 'published' or published_at is null;
