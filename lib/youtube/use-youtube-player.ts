"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { loadYoutubeIframeApi, type YTPlayerInstance } from "./iframe-api";

export type YoutubePlayerHandle = {
  ready: boolean;
  playing: boolean;
  duration: number;
  /** Real video width/height once the provider reports it; null when unknown. */
  aspectRatio: number | null;
  play: () => void;
  pause: () => void;
  setPlaybackRate: (rate: number) => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
};

export function useYoutubePlayer(
  containerRef: RefObject<HTMLDivElement | null>,
  videoId: string,
  muted: boolean,
  compactChrome = false,
  loop = true,
): YoutubePlayerHandle {
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videoId) return;

    let destroyed = false;
    const pollTimers: number[] = [];
    const mountNode = document.createElement("div");
    container.appendChild(mountNode);

    loadYoutubeIframeApi().then((YT) => {
      if (destroyed) return;
      const player = new YT.Player(mountNode, {
        videoId,
        playerVars: {
          mute: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            player.getIframe().style.cssText = compactChrome
              ? "position:absolute;left:50%;top:50%;width:135%;height:135%;border:0;pointer-events:none;transform:translate(-50%,-50%) scale(.740741);"
              : "position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;";
            playerRef.current = player;
            setReady(true);
            // getDuration() is often 0 until metadata arrives, so poll briefly
            // to surface the length before playback starts (e.g. card badges).
            let attempts = 0;
            const poll = window.setInterval(() => {
              const value = destroyed ? 0 : player.getDuration();
              if (value > 0) setDuration(value);
              if (destroyed || value > 0 || ++attempts >= 20) window.clearInterval(poll);
            }, 400);
            pollTimers.push(poll);
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              setPlaying(true);
              setDuration(player.getDuration());
            } else if (event.data === 0) {
              if (loop) {
                // Loop manually instead of using playerVars.loop/playlist,
                // which makes YouTube show playlist prev/next chrome.
                player.seekTo(0, true);
                player.playVideo();
              } else {
                setPlaying(false);
              }
            } else if (event.data === 2) {
              setPlaying(false);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      pollTimers.forEach((timer) => window.clearInterval(timer));
      playerRef.current?.destroy();
      playerRef.current = null;
      if (mountNode.parentNode === container) container.removeChild(mountNode);
      setReady(false);
      setPlaying(false);
      setDuration(0);
    };
  }, [compactChrome, containerRef, loop, videoId]);

  useEffect(() => {
    if (!ready) return;
    if (muted) playerRef.current?.mute();
    else playerRef.current?.unMute();
  }, [muted, ready]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const setPlaybackRate = useCallback((rate: number) => playerRef.current?.setPlaybackRate(rate), []);
  const seekTo = useCallback((seconds: number) => playerRef.current?.seekTo(seconds, true), []);
  const getCurrentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? 0, []);

  return useMemo(
    () => ({ ready, playing, duration, aspectRatio: null, play, pause, setPlaybackRate, seekTo, getCurrentTime }),
    [ready, playing, duration, play, pause, setPlaybackRate, seekTo, getCurrentTime],
  );
}
