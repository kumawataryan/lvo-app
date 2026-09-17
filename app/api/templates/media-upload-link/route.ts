import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const ID_PATTERN = /^[0-9a-f-]{36}$/i;
const EXTENSION_PATTERN = /^[a-z0-9]{1,8}$/;

function slugifyFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "You do not have permission to upload templates." }, { status: 403 });

  const body = await request.json().catch(() => null) as { uploadGroup?: unknown; folder?: unknown; extension?: unknown; index?: unknown; name?: unknown } | null;
  const uploadGroup = typeof body?.uploadGroup === "string" ? body.uploadGroup : "";
  const folder = body?.folder === "gallery" || body?.folder === "thumbnail" ? body.folder : "";
  const extension = typeof body?.extension === "string" ? body.extension.toLowerCase() : "";
  const index = Number(body?.index);
  const rawName = typeof body?.name === "string" ? body.name.replace(/\.[a-z0-9]+$/i, "") : "";
  if (!ID_PATTERN.test(uploadGroup) || !folder || !EXTENSION_PATTERN.test(extension)) {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }
  if (!["jpg", "jpeg", "png", "webp"].includes(extension)) return Response.json({ error: "Unsupported file type." }, { status: 400 });
  if (folder === "gallery" && (!Number.isInteger(index) || index < 0 || index > 9)) {
    return Response.json({ error: "Invalid gallery position." }, { status: 400 });
  }

  const slug = slugifyFilename(rawName) || (folder === "gallery" ? `gallery-${index + 1}` : "thumbnail");
  const filename = `${slug}.${extension}`;
  const path = `${user.id}/${uploadGroup}/${filename}`;
  try {
    const serviceClient = createSupabaseServiceRoleClient();
    const { data, error } = await serviceClient.storage.from("template-media").createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("Unable to prepare Supabase upload.");
    return Response.json({ path, token: data.token });
  } catch (error) {
    console.error("Unable to create Supabase media upload link", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to prepare upload." }, { status: 500 });
  }
}
