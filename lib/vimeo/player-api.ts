"use client";

export type VimeoPlayerInstance = {
  element: HTMLIFrameElement;
  ready: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<boolean>;
  setPlaybackRate: (rate: number) => Promise<number>;
  setCurrentTime: (seconds: number) => Promise<number>;
  getDuration: () => Promise<number>;
  getVideoWidth: () => Promise<number>;
  getVideoHeight: () => Promise<number>;
  on: (event: string, callback: (data: { seconds?: number }) => void) => void;
  destroy: () => Promise<void>;
};

type VimeoNamespace = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => VimeoPlayerInstance;
};

declare global {
  interface Window {
    Vimeo?: VimeoNamespace;
  }
}

const SCRIPT_SRC = "https://player.vimeo.com/api/player.js";
let apiPromise: Promise<VimeoNamespace> | null = null;

export function loadVimeoPlayerApi(): Promise<VimeoNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("Vimeo Player API requires a browser."));
  if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(window.Vimeo!));
    script.addEventListener("error", () => { apiPromise = null; reject(new Error("Unable to load the Vimeo Player API.")); });
    if (!existing) {
      script.src = SCRIPT_SRC;
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}
