"use client";

// A tiny shared "a page change is in progress" flag, so any tap that navigates (navbar, template
// cards, …) can show the same top progress bar. RouteProgress clears it when the new route renders.

type Listener = () => void;

let pendingHref: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Call right before router.push / Link navigation. Ignored when already on that page. */
export function startNavigationProgress(href: string) {
  if (typeof window === "undefined") return;
  const target = new URL(href, window.location.href);
  if (target.pathname === window.location.pathname && target.search === window.location.search) return;
  pendingHref = target.pathname + target.search;
  emit();
}

export function stopNavigationProgress() {
  if (pendingHref === null) return;
  pendingHref = null;
  emit();
}

export function subscribeNavigationProgress(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPendingNavigation() {
  return pendingHref;
}
