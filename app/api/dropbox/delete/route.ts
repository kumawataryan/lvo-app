import { canUserAddTemplates } from "@/lib/auth/permissions";
import { deleteDropboxFile } from "@/lib/dropbox/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const body = await request.json().catch(() => null) as { paths?: unknown } | null;
  const ownedPrefix = `/lvo-files/${user.id}/`;
  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((path): path is string => typeof path === "string" && path.startsWith(ownedPrefix)).slice(0, 12)
    : [];
  await Promise.allSettled(paths.map(deleteDropboxFile));
  return Response.json({ ok: true });
}
