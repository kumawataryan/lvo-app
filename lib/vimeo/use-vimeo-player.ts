"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { YoutubePlayerHandle } from "@/lib/youtube/use-youtube-player";
import { vimeoPageUrl } from "@/lib/templates/video-embed";
import { loadVimeoPlayerApi, type VimeoPlayerInstance } from "./player-api";

type VimeoVideo = { id: string; hash?: string };

/** Same handle shape as the YouTube hook so callers can swap providers. */
export function useVimeoPlayer(
  containerRef: RefObject<HTMLDivElement | null>,
  video: VimeoVideo | null,
  muted: boolean,
  loop = true,
  cover = false,
): YoutubePlayerHandle {
  const playerRef = useRef<VimeoPlayerInstance | null>(null);
  const currentTimeRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const videoId = video?.id ?? "";
  const videoHash = video?.hash;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videoId) return;

    let destroyed = false;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    const mountNode = document.createElement("div");
    mountNode.style.cssText = "position:absolute;inset:0;width:100%;height:100%;overflow:hidden;";
    container.appendChild(mountNode);

    loadVimeoPlayerApi().then((Vimeo) => {
      if (destroyed) return;
      const player = new Vimeo.Player(mountNode, {
        url: vimeoPageUrl({ provider: "vimeo", id: videoId, hash: videoHash }),
        controls: false,
        muted: true,
        loop: false,
        autoplay: false,
        playsinline: true,
        keyboard: false,
        pip: false,
        dnt: true,
        title: false,
        byline: false,
        portrait: false,
      });
      // The SDK builds the iframe asynchronously (after an oEmbed lookup), so `player.element`
      // is still the mount node here. Style the real iframe whenever it exists, or it keeps
      // Vimeo's fixed default size instead of filling the container.
      let ratio = 0;
      const applyLayout = () => {
        const iframe = mountNode.querySelector("iframe");
        if (!iframe) return;
        const base = "border:0;pointer-events:none;max-width:none;";
        if (!cover || !ratio) {
          iframe.style.cssText = `position:absolute;inset:0;width:100%;height:100%;${base}`;
          return;
        }
        // Crop-to-fill: size the frame to the video's own ratio, then scale until it covers the container.
        const width = Math.max(container.clientWidth, container.clientHeight * ratio);
        iframe.style.cssText = `position:absolute;left:50%;top:50%;width:${width}px;height:${width / ratio}px;transform:translate(-50%,-50%);${base}`;
      };
      mutationObserver = new MutationObserver(applyLayout);
      mutationObserver.observe(mountNode, { childList: true });
      resizeObserver = new ResizeObserver(applyLayout);
      resizeObserver.observe(container);
      applyLayout();
      playerRef.current = player;

      player.on("play", () => setPlaying(true));
      player.on("pause", () => setPlaying(false));
      player.on("timeupdate", (data) => { currentTimeRef.current = data.seconds ?? 0; });
      player.on("ended", () => {
        // Loop manually so the end screen / recommendations never show.
        if (loop) {
          player.setCurrentTime(0).then(() => player.play()).catch(() => undefined);
        } else {
          setPlaying(false);
        }
      });
      player.ready().then(() => {
        if (destroyed) return;
        setReady(true);
        return Promise.all([player.getDuration(), player.getVideoWidth(), player.getVideoHeight()]).then(([length, width, height]) => {
          if (destroyed) return;
          setDuration(length);
          if (width && height) {
            ratio = width / height;
            setAspectRatio(ratio);
            applyLayout();
          }
        });
      }).catch(() => undefined);
    }).catch(() => undefined);

    return () => {
      destroyed = true;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      playerRef.current?.destroy().catch(() => undefined);
      playerRef.current = null;
      if (mountNode.parentNode === container) container.removeChild(mountNode);
      currentTimeRef.current = 0;
      setReady(false);
      setPlaying(false);
      setDuration(0);
      setAspectRatio(null);
    };
  }, [containerRef, cover, loop, videoId, videoHash]);

  useEffect(() => {
    if (!ready) return;
    playerRef.current?.setMuted(muted).catch(() => undefined);
  }, [muted, ready]);

  const play = useCallback(() => { playerRef.current?.play().catch(() => undefined); }, []);
  const pause = useCallback(() => { playerRef.current?.pause().catch(() => undefined); }, []);
  const setPlaybackRate = useCallback((rate: number) => { playerRef.current?.setPlaybackRate(rate).catch(() => undefined); }, []);
  const seekTo = useCallback((seconds: number) => {
    currentTimeRef.current = seconds;
    playerRef.current?.setCurrentTime(seconds).catch(() => undefined);
  }, []);
  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  return useMemo(
    () => ({ ready, playing, duration, aspectRatio, play, pause, setPlaybackRate, seekTo, getCurrentTime }),
    [ready, playing, duration, aspectRatio, play, pause, setPlaybackRate, seekTo, getCurrentTime],
  );
}
