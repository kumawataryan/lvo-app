import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/templates/repository";

export async function GET(request: Request) {
  const authClient = await createSupabaseAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);

  const supabase = createSupabaseServiceRoleClient();
  let query = supabase
    .from("templates")
    .select("id, title, status, thumbnail_path, updated_at", { count: "exact" })
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data: rows, count, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const templates = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as "draft" | "published" | "archived",
    thumbnailUrl: publicMediaUrl(row.thumbnail_path),
    updatedAt: row.updated_at as string,
  }));

  return Response.json({ templates, hasMore: offset + templates.length < (count ?? 0) });
}
