import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionUser = { id: string; app_metadata: Record<string, unknown> };

/**
 * Fast user lookup for rendering pages. getClaims() verifies the JWT signature locally (no auth-server round trip
 * with asymmetric signing keys), unlike getUser(). Use getUser() for anything that mutates data.
 */
export async function getSessionUser(supabase: SupabaseClient): Promise<SessionUser | null> {
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return null;
    return { id: claims.sub, app_metadata: (claims.app_metadata as Record<string, unknown> | undefined) ?? {} };
  } catch {
    return null;
  }
}
