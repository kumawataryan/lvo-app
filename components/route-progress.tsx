"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getPendingNavigation, stopNavigationProgress, subscribeNavigationProgress } from "@/lib/navigation/progress";

const SAFETY_TIMEOUT_MS = 15_000;

/** Thin brand-coloured bar along the top of the screen while a page change is in progress. */
export function RouteProgress() {
  const pending = useSyncExternalStore(subscribeNavigationProgress, getPendingNavigation, () => null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The new route rendered (or the user went back): navigation is done.
  useEffect(() => {
    stopNavigationProgress();
  }, [pathname, searchParams]);

  // Never leave the bar stuck if a navigation is cancelled or fails silently.
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(stopNavigationProgress, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <div aria-hidden="true" className={`route-progress pointer-events-none fixed inset-x-0 top-0 z-[3000] h-[1.5px] ${pending ? "route-progress-active" : ""}`}>
      <div className="route-progress-bar h-full bg-brand shadow-[0_0_6px_rgba(153,43,241,0.5)]" />
    </div>
  );
}
