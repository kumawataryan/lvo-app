import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const body = await request.json().catch(() => null) as { paths?: unknown } | null;
  const ownedPrefix = `${user.id}/`;
  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((path): path is string => typeof path === "string" && path.startsWith(ownedPrefix)).slice(0, 12)
    : [];
  if (paths.length) {
    const serviceClient = createSupabaseServiceRoleClient();
    await serviceClient.storage.from("template-media").remove(paths);
  }
  return Response.json({ ok: true });
}
