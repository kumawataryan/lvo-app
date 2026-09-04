"use client";

import { ArrowLeft, Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BottomNav } from "@/components/craft-app";
import type { CraftClassVideo } from "@/lib/craft-classes";
import { parseVideoEmbedUrl } from "@/lib/templates/video-embed";
import { useYoutubePlayer } from "@/lib/youtube/use-youtube-player";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export function CraftClassVideoScreen({ craftClass }: { craftClass: CraftClassVideo }) {
  const router = useRouter();
  const [selectedVideoId, setSelectedVideoId] = useState(() => craftClass?.playlist?.videos[0]?.id ?? craftClass?.id ?? "");
  const video = craftClass?.playlist?.videos.find((item) => item.id === selectedVideoId) ?? craftClass;
  const embed = video ? parseVideoEmbedUrl(video.youtubeUrl) : null;
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const player = useYoutubePlayer(playerContainerRef, embed?.id ?? "", muted, false, false);

  useEffect(() => {
    if (!player.playing) return;
    const interval = window.setInterval(() => setCurrentTime(player.getCurrentTime()), 250);
    return () => window.clearInterval(interval);
  }, [player]);

  useEffect(() => {
    const handleFullscreenChange = () => setExpanded(Boolean(document.fullscreenElement));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleLandscapePlayer = async () => {
    const frame = videoFrameRef.current;
    if (!frame) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    try {
      await frame.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };
      await orientation.lock?.("landscape").catch(() => undefined);
    } catch {
      // Keep the in-app fullscreen fallback active when native fullscreen is unavailable.
    }
  };

  if (!video || !embed) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white px-4 text-center text-black">
        <div>
          <p className="text-sm font-semibold">Class not found</p>
          <button type="button" onClick={() => router.push("/craft-classes")} className="mt-5 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white">Back to classes</button>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 bg-[var(--background)] text-black">
      <div className={`relative mx-auto flex h-dvh w-full flex-col bg-white ${expanded ? "max-w-none overflow-visible" : "max-w-[430px] overflow-hidden"}`}>
        <header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[calc(16px+env(safe-area-inset-top))]">
          <button type="button" aria-label="Back to craft classes" onClick={() => router.push("/craft-classes")} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2f2f2] transition active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">{video.title}</h1>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-32 pt-3">
          <div ref={videoFrameRef} className={`${expanded ? "fixed inset-0 z-[100] flex h-dvh w-dvw flex-col justify-center rounded-none bg-white" : "overflow-hidden rounded-[18px] bg-white"} fullscreen:flex fullscreen:h-screen fullscreen:w-screen fullscreen:flex-col fullscreen:justify-center fullscreen:rounded-none`}>
            <div className="relative aspect-video overflow-hidden rounded-[18px] bg-black fullscreen:w-full fullscreen:rounded-none">
              <div ref={playerContainerRef} className="absolute inset-0 overflow-hidden" />
              {!player.playing ? (
                <Image
                  src={`https://i.ytimg.com/vi/${embed.id}/hqdefault.jpg`}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 430px) calc(100vw - 32px), 398px"
                  className="object-cover"
                />
              ) : null}
              <button type="button" aria-label={player.playing ? "Pause video" : "Play video"} onClick={() => player.playing ? player.pause() : player.play()} className="absolute inset-0 z-10" />
            </div>
            <div className="flex items-center gap-2.5 px-1 py-3.5 text-black fullscreen:px-3">
              <button type="button" aria-label={player.playing ? "Pause" : "Play"} onClick={() => player.playing ? player.pause() : player.play()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
                {player.playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
              </button>
              <span className="w-9 text-xs tabular-nums text-black/55">{formatTime(currentTime)}</span>
              <input type="range" aria-label="Video progress" min={0} max={player.duration || 0} step="0.1" value={Math.min(currentTime, player.duration || 0)} onChange={(event) => { const time = Number(event.target.value); player.seekTo(time); setCurrentTime(time); }} className="h-6 min-w-0 flex-1 accent-black" />
              <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((value) => !value)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button type="button" aria-label={expanded ? "Exit fullscreen" : "View horizontally"} onClick={toggleLandscapePlayer} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
                {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {craftClass.playlist ? (
            <div className="mt-3">
              <div>
                {craftClass.playlist.videos.map((playlistVideo) => {
                  const isActive = playlistVideo.id === video.id;
                  return (
                    <button
                      key={playlistVideo.id}
                      type="button"
                      onClick={() => {
                        player.pause();
                        setCurrentTime(0);
                        setSelectedVideoId(playlistVideo.id);
                      }}
                      className="flex w-full items-center gap-3 py-2 text-left transition active:scale-[0.99]"
                    >
                      <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-black">
                        <Image src={`https://i.ytimg.com/vi/${playlistVideo.id}/mqdefault.jpg`} alt="" fill sizes="128px" className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`line-clamp-2 text-[13px] font-medium leading-[18px] ${isActive ? "text-black" : "text-black/65"}`}>{playlistVideo.title}</span>
                        {isActive ? <span className="mt-1 block text-[10px] font-medium text-black/40">Now playing</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <BottomNav active="browse" onChange={(tab) => router.push(tab === "templates" ? "/" : `/?tab=${tab}`)} />
      </div>
    </main>
  );
}
