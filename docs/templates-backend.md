# Templates backend

This phase covers public template content only. Authentication, likes, saved collections, subscriptions, payments, and administrative write APIs are intentionally excluded.

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL and publishable key.
3. Run `supabase/migrations/202608260001_templates_backend.sql` with the Supabase CLI or SQL editor.
4. Upload public videos, thumbnails, and gallery images to `template-media` using paths stored in the database.
5. Upload PDFs to the private `template-printables` bucket. The public templates API deliberately does not return printable paths or signed URLs.

The migration creates categories, templates, gallery images, supplies, template-to-supply relationships, indexes, RLS policies, storage buckets, and one seed template.

## Public read API

- `GET /api/templates`
- `GET /api/templates?category=paper-crafts`
- `GET /api/templates?search=flower&featured=true&limit=20`
- `GET /api/templates/paper-flower-bouquet`

Only published templates whose `published_at` time has arrived are returned. Responses are cached at the CDN for 60 seconds and can be served stale for five minutes during revalidation.

## Media paths

Database columns store bucket-relative paths, not complete URLs:

- `video_path`: `paper-flower-bouquet/video.mp4`
- `thumbnail_path`: `paper-flower-bouquet/cover.webp`
- gallery `storage_path`: `paper-flower-bouquet/gallery-1.webp`
- `printable_path`: `paper-flower-bouquet/printable.pdf`

## Tags and search

Templates can have up to 20 normalized tags. Tags are stored in `template_tags` and linked through
`template_tag_assignments`, allowing reuse without duplicating tag data. The `templates.search_text`
column combines the title, description, and assigned tags and is backed by a partial trigram GIN
index for published-template search. Apply `202609110001_template_tags.sql` before deploying the
tag-enabled application code.

Apply `202609110002_smart_template_search.sql` to enable relevance-ranked, order-independent,
typo-tolerant search across template titles, descriptions, and tags.

The server repository turns public media paths into Supabase CDN URLs. Printable paths remain private for the future subscription entitlement flow.
