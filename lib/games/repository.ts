import "server-only";

import type { Game } from "@/lib/games";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type GameRow = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  minimum_age: number | null;
  maximum_age: number | null;
  html_path: string;
  featured_image_path: string | null;
};

const gameSelection = "slug, title, description, tags, minimum_age, maximum_age, html_path, featured_image_path";

function publicGameUrl(path: string) {
  return createSupabaseServerClient().storage.from("games").getPublicUrl(path).data.publicUrl;
}

function mapGame(row: GameRow): Game {
  return {
    id: row.slug,
    title: row.title,
    description: row.description,
    tags: row.tags,
    minimumAge: row.minimum_age,
    maximumAge: row.maximum_age,
    htmlUrl: publicGameUrl(row.html_path),
    featuredImageUrl: row.featured_image_path ? publicGameUrl(row.featured_image_path) : null,
  };
}

export async function listPublishedGames(): Promise<Game[]> {
  const { data, error } = await createSupabaseServerClient()
    .from("games")
    .select(gameSelection)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Unable to load games: ${error.message}`);
  return ((data ?? []) as unknown as GameRow[]).map(mapGame);
}

export async function getPublishedGameBySlug(slug: string): Promise<Game | null> {
  const { data, error } = await createSupabaseServerClient()
    .from("games")
    .select(gameSelection)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`Unable to load game: ${error.message}`);
  return data ? mapGame(data as unknown as GameRow) : null;
}

// Supabase Storage serves .html as text/plain, so the file cannot be framed by URL.
// Fetch the source server-side and render it through iframe srcDoc instead.
export async function loadGameHtml(game: Game): Promise<string> {
  const response = await fetch(game.htmlUrl, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Unable to load game file (${response.status}).`);
  return response.text();
}
