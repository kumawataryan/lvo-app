import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/templates/repository";

const RESULT_LIMIT = 30;

// Searches every published template by title, for the "similar templates" picker in the template form.
export async function GET(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "You do not have permission." }, { status: 403 });

  const url = new URL(request.url);
  // Strip characters that have a special meaning in LIKE patterns or PostgREST filters.
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80).replace(/[%_,()]/g, " ").trim();
  const exclude = url.searchParams.get("exclude") ?? "";

  let request_ = supabase
    .from("templates")
    .select("id, title, thumbnail_path")
    .eq("status", "published")
    .order("title", { ascending: true })
    .limit(RESULT_LIMIT);
  if (query) request_ = request_.ilike("title", `%${query}%`);
  if (exclude) request_ = request_.neq("id", exclude);

  const { data, error } = await request_;
  if (error) return Response.json({ error: "Could not search templates." }, { status: 500 });

  const options = (data ?? []).map((row) => ({ id: row.id, title: row.title, imageUrl: publicMediaUrl(row.thumbnail_path) }));
  return Response.json({ options });
}
