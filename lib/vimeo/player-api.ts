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
    let settled = false;
    // A failed or stalled load must not leave every later Vimeo card waiting forever: drop the tag and let the next mount retry.
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      apiPromise = null;
      script.remove();
      reject(new Error(message));
    };
    const timeout = setTimeout(() => fail("Timed out loading the Vimeo Player API."), 15_000);
    script.addEventListener("load", () => {
      if (settled) return;
      if (window.Vimeo?.Player) {
        settled = true;
        clearTimeout(timeout);
        resolve(window.Vimeo);
      } else {
        fail("The Vimeo Player API did not initialise.");
      }
    });
    script.addEventListener("error", () => fail("Unable to load the Vimeo Player API."));
    if (!existing) {
      script.src = SCRIPT_SRC;
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}
