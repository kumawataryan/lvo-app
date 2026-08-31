export type VideoEmbed = { id: string };

export function parseVideoEmbedUrl(rawUrl: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtube.com") {
    const shortsMatch = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{6,})/);
    if (shortsMatch) return { id: shortsMatch[1] };
    const watchId = url.searchParams.get("v");
    if (watchId && /^[a-zA-Z0-9_-]{6,}$/.test(watchId)) return { id: watchId };
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? { id } : null;
  }
  return null;
}
