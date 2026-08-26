"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Story } from "@/components/craft-app";

type StoryPlayerContextValue = {
  story: Story | null;
  progress: number;
  playing: boolean;
  minimized: boolean;
  openStory: (story: Story) => void;
  minimize: () => void;
  restore: () => void;
  setPlaying: (playing: boolean) => void;
  setProgress: (progress: number) => void;
};

const StoryPlayerContext = createContext<StoryPlayerContextValue | null>(null);

export function StoryPlayerProvider({ children }: { children: ReactNode }) {
  const [story, setStory] = useState<Story | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load the story's narration whenever it changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (story?.audioSrc) {
      audio.src = story.audioSrc;
      audio.currentTime = 0;
      audio.load();
    } else {
      audio.removeAttribute("src");
      audio.load();
    }
  }, [story?.audioSrc]);

  // Keep the audio element's transport state in sync with `playing`.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !story?.audioSrc) return;
    if (playing) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [playing, story]);

  // Drive `progress` from real playback position when narration exists; otherwise fall
  // back to a simulated timer (for any story without an audio file).
  useEffect(() => {
    const audio = audioRef.current;
    if (story?.audioSrc && audio) {
      const handleTimeUpdate = () => setProgress(audio.currentTime);
      const handleEnded = () => {
        audio.currentTime = 0;
        setProgress(0);
        setPlaying(false);
      };
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", handleEnded);
      return () => {
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", handleEnded);
      };
    }

    if (!story || !playing) return;
    const timer = window.setInterval(() => {
      setProgress((current) => (current >= story.duration ? 0 : current + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [story, playing]);

  const openStory = (next: Story) => {
    setStory(next);
    setProgress(0);
    setPlaying(true);
    setMinimized(false);
  };

  const seek = (next: number) => {
    const audio = audioRef.current;
    if (story?.audioSrc && audio) audio.currentTime = next;
    setProgress(next);
  };

  const value: StoryPlayerContextValue = {
    story,
    progress,
    playing,
    minimized,
    openStory,
    minimize: () => setMinimized(true),
    restore: () => setMinimized(false),
    setPlaying,
    setProgress: seek,
  };

  return (
    <StoryPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="auto" />
    </StoryPlayerContext.Provider>
  );
}

export function useStoryPlayer() {
  const context = useContext(StoryPlayerContext);
  if (!context) throw new Error("useStoryPlayer must be used within a StoryPlayerProvider");
  return context;
}
