alter table public.templates
  alter column video_path drop not null,
  add column video_embed_url text;

alter table public.templates
  add constraint templates_video_source_check check (
    (video_path is not null and video_embed_url is null)
    or (video_path is null and video_embed_url is not null)
  );
