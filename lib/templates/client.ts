import type { PublishedTemplate } from "@/lib/templates/types";

export async function fetchPublishedTemplates(signal?: AbortSignal) {
  const response = await fetch("/api/templates", { signal });
  if (!response.ok) throw new Error("Unable to load templates.");
  const payload = await response.json() as { data: PublishedTemplate[] };
  return payload.data;
}
