"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "lvo-install-dismissed";

// A homepage grid tile that offers to install the app. It shows nothing unless installing is possible.
export function InstallTile() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    if (window.matchMedia("(display-mode: standalone)").matches) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Storage can be blocked; keep the tile available.
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS has no install prompt, so the tile explains the Share menu instead.
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      setIosHint(true);
      setHidden(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Ignore blocked storage.
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setHidden(true);
  };

  if (hidden) return null;

  return (
    <div className="overflow-hidden rounded-[22px] bg-[#f2eee8]">
      <div className="flex aspect-square items-center justify-center">
        <img src="/icons/icon-192.png" alt="" className="h-20 w-20 rounded-2xl shadow-md" />
      </div>
      <div className="px-4 pb-4">
        {iosHint ? (
          <p className="text-center text-xs text-black/60">Tap Share, then Add to Home Screen.</p>
        ) : (
          <button type="button" onClick={install} className="h-10 w-full rounded-xl bg-brand text-sm font-semibold text-white transition active:scale-[0.98]">Install Lovely.diy App</button>
        )}
        <button type="button" onClick={dismiss} className="mt-2 w-full text-center text-xs text-black/45 transition hover:text-black">Not now</button>
      </div>
    </div>
  );
}
