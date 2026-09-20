"use client";

import type { RefObject } from "react";
import type { VideoEmbed } from "@/lib/templates/video-embed";
import { useVimeoPlayer } from "@/lib/vimeo/use-vimeo-player";
import { useYoutubePlayer, type YoutubePlayerHandle } from "@/lib/youtube/use-youtube-player";

/** One player handle for any supported embed provider (YouTube or Vimeo). */
export function useEmbedPlayer(
  containerRef: RefObject<HTMLDivElement | null>,
  embed: VideoEmbed | null,
  muted: boolean,
  compactChrome = false,
  loop = true,
): YoutubePlayerHandle {
  // Both hooks always run; the inactive one gets no video and stays idle.
  const youtube = useYoutubePlayer(containerRef, embed?.provider === "youtube" ? embed.id : "", muted, compactChrome, loop);
  const vimeo = useVimeoPlayer(containerRef, embed?.provider === "vimeo" ? embed : null, muted, loop, compactChrome);
  return embed?.provider === "vimeo" ? vimeo : youtube;
}
