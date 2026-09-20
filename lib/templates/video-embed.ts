export type VideoEmbed =
  | { provider: "youtube"; id: string; shorts?: boolean }
  | { provider: "vimeo"; id: string; hash?: string };

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{6,}$/;

function parseVimeoUrl(url: URL): VideoEmbed | null {
  const segments = url.pathname.split("/").filter(Boolean);
  const idIndex = segments.findIndex((segment) => /^\d+$/.test(segment));
  if (idIndex === -1) return null;
  const id = segments[idIndex];
  // Unlisted videos carry a privacy hash: vimeo.com/{id}/{hash} or player.vimeo.com/video/{id}?h={hash}.
  const candidate = url.searchParams.get("h") ?? segments[idIndex + 1];
  const hash = candidate && /^[0-9a-f]{8,}$/i.test(candidate) ? candidate : undefined;
  return hash ? { provider: "vimeo", id, hash } : { provider: "vimeo", id };
}

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
    if (shortsMatch) return { provider: "youtube", id: shortsMatch[1], shorts: true };
    const watchId = url.searchParams.get("v");
    if (watchId && YOUTUBE_ID.test(watchId)) return { provider: "youtube", id: watchId };
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id && YOUTUBE_ID.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") return parseVimeoUrl(url);
  return null;
}

/** Best-guess width/height before the real size is known: Shorts are vertical, other YouTube videos widescreen. */
export function embedFallbackRatio(embed: VideoEmbed) {
  return embed.provider === "youtube" && !embed.shorts ? 16 / 9 : 9 / 16;
}

export const VIDEO_LINK_ERROR = "Paste a valid YouTube or Vimeo link.";

/** Canonical vimeo.com page URL, used by the Vimeo player SDK and oEmbed. */
export function vimeoPageUrl(embed: Extract<VideoEmbed, { provider: "vimeo" }>) {
  return `https://vimeo.com/${embed.id}${embed.hash ? `/${embed.hash}` : ""}`;
}

/** Muted, looping, chrome-less iframe source for static previews. */
export function videoEmbedPreviewSrc(embed: VideoEmbed) {
  if (embed.provider === "vimeo") {
    const hash = embed.hash ? `&h=${embed.hash}` : "";
    return `https://player.vimeo.com/video/${embed.id}?autoplay=1&muted=1&loop=1&controls=0&background=1&dnt=1&playsinline=1${hash}`;
  }
  return `https://www.youtube-nocookie.com/embed/${embed.id}?autoplay=1&mute=1&loop=1&playlist=${embed.id}&controls=0&rel=0&modestbranding=1&playsinline=1`;
}
