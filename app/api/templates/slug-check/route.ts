import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/templates/slug";
import { resolveTemplateSlug } from "@/lib/templates/slug-server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Live slug availability for the template form: { slug, available, suggestion }.
export async function GET(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "You do not have permission to add templates." }, { status: 403 });

  const url = new URL(request.url);
  const slug = slugify(url.searchParams.get("slug") ?? "");
  const excludeId = url.searchParams.get("excludeId") ?? "";
  if (!slug) return Response.json({ error: "Enter a slug with letters or numbers." }, { status: 400 });
  if (excludeId && !UUID_PATTERN.test(excludeId)) return Response.json({ error: "Invalid template." }, { status: 400 });

  try {
    const result = await resolveTemplateSlug(slug, excludeId || undefined);
    return Response.json({ slug, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to check the slug." }, { status: 500 });
  }
}
