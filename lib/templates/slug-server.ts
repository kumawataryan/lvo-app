import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { nextAvailableSlug } from "@/lib/templates/slug";

/**
 * Checks a slug against every template (drafts included, so the service role client is used)
 * and returns the first free variant: the slug itself, or slug-2, slug-3, …
 * `excludeId` skips the template being edited so it doesn't clash with its own slug.
 */
export async function resolveTemplateSlug(slug: string, excludeId?: string) {
  const supabase = createSupabaseServiceRoleClient();
  // Slugs only contain a-z, 0-9 and hyphens, so they are safe inside a LIKE pattern (PostgREST uses * as the wildcard).
  let query = supabase.from("templates").select("slug").or(`slug.eq.${slug},slug.like.${slug}-*`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(1000);
  if (error) throw new Error(`Unable to check the slug: ${error.message}`);
  const taken = new Set((data ?? []).map((row: { slug: string }) => row.slug));
  return { available: !taken.has(slug), suggestion: nextAvailableSlug(slug, taken) };
}
