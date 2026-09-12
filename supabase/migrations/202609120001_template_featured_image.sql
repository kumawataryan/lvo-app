alter table public.templates
  drop constraint templates_video_source_check;

alter table public.templates
  add constraint templates_video_source_check check (
    (video_path is not null and video_embed_url is null)
    or (video_path is null and video_embed_url is not null)
    or (video_path is null and video_embed_url is null and thumbnail_path is not null)
  );
