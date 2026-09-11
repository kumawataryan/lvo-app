import type { PublishedTemplate } from "@/lib/templates/types";

export async function fetchPublishedTemplates(signal?: AbortSignal, options: { search?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.search) params.set("search", options.search);
  if (options.limit) params.set("limit", String(options.limit));
  const response = await fetch(`/api/templates${params.size ? `?${params}` : ""}`, { signal });
  if (!response.ok) throw new Error("Unable to load templates.");
  const payload = await response.json() as { data: PublishedTemplate[] };
  return payload.data;
}
