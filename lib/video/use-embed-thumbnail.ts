"use client";

import { useEffect, useState } from "react";
import { vimeoPageUrl, type VideoEmbed } from "@/lib/templates/video-embed";

const vimeoThumbnailCache = new Map<string, string>();

/** Poster image URL for an embed. YouTube's is derivable; Vimeo's comes from its oEmbed endpoint. */
export function useEmbedThumbnail(embed: VideoEmbed | null, enabled = true): string | null {
  const vimeoUrl = embed?.provider === "vimeo" ? vimeoPageUrl(embed) : null;
  const [fetched, setFetched] = useState<{ url: string; thumbnail: string } | null>(null);

  useEffect(() => {
    if (!enabled || !vimeoUrl || vimeoThumbnailCache.has(vimeoUrl)) return;
    let cancelled = false;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(vimeoUrl)}&width=640`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { thumbnail_url?: string } | null) => {
        if (!data?.thumbnail_url) return;
        vimeoThumbnailCache.set(vimeoUrl, data.thumbnail_url);
        if (!cancelled) setFetched({ url: vimeoUrl, thumbnail: data.thumbnail_url });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [enabled, vimeoUrl]);

  if (!embed) return null;
  if (embed.provider === "youtube") return enabled ? `https://i.ytimg.com/vi/${embed.id}/hqdefault.jpg` : null;
  if (!vimeoUrl) return null;
  return vimeoThumbnailCache.get(vimeoUrl) ?? (fetched?.url === vimeoUrl ? fetched.thumbnail : null);
}
