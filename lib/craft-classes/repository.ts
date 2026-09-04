import "server-only";

import type { CraftClassVideo } from "@/lib/craft-classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CraftClassRow = {
  slug: string;
  title: string;
  youtube_url: string;
  playlist_id: string | null;
};

const craftClassSelection = "slug, title, youtube_url, playlist_id";

function decodeXml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

async function loadYoutubePlaylistVideos(playlistId: string): Promise<CraftClassVideo[]> {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Unable to load YouTube playlist feed (${response.status}).`);

  const xml = await response.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap((match) => {
    const videoId = match[1].match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = match[1].match(/<title>([\s\S]*?)<\/title>/)?.[1];
    return videoId && title
      ? [{ id: videoId, title: decodeXml(title.trim()), youtubeUrl: `https://www.youtube.com/watch?v=${videoId}` }]
      : [];
  });
}

async function mapCraftClass(row: CraftClassRow): Promise<CraftClassVideo> {
  const videos = row.playlist_id ? await loadYoutubePlaylistVideos(row.playlist_id) : [];

  return {
    id: row.slug,
    title: row.title,
    youtubeUrl: row.youtube_url,
    ...(row.playlist_id ? { playlist: { id: row.playlist_id, videos } } : {}),
  };
}

export async function listPublishedCraftClasses(): Promise<CraftClassVideo[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("craft_classes")
    .select(craftClassSelection)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Unable to load craft classes: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as CraftClassRow[]).map(mapCraftClass));
}

export async function getPublishedCraftClassBySlug(slug: string): Promise<CraftClassVideo | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("craft_classes")
    .select(craftClassSelection)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`Unable to load craft class: ${error.message}`);
  return data ? await mapCraftClass(data as unknown as CraftClassRow) : null;
}
