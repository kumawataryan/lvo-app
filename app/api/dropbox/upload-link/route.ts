import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createDropboxUploadLink } from "@/lib/dropbox/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";

const ID_PATTERN = /^[0-9a-f-]{36}$/i;
const EXTENSION_PATTERN = /^[a-z0-9]{1,8}$/;

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "You do not have permission to upload templates." }, { status: 403 });

  const body = await request.json().catch(() => null) as { uploadGroup?: unknown; folder?: unknown; extension?: unknown; index?: unknown } | null;
  const uploadGroup = typeof body?.uploadGroup === "string" ? body.uploadGroup : "";
  const folder = body?.folder === "printable" || body?.folder === "gallery" || body?.folder === "thumbnail" ? body.folder : "";
  const extension = typeof body?.extension === "string" ? body.extension.toLowerCase() : "";
  const index = Number(body?.index);
  if (!ID_PATTERN.test(uploadGroup) || !folder || !EXTENSION_PATTERN.test(extension)) {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }
  const extensionAllowed = folder === "printable"
    ? ["pdf", "zip", "jpg", "jpeg", "png", "webp"].includes(extension)
    : ["jpg", "jpeg", "png", "webp"].includes(extension);
  if (!extensionAllowed) return Response.json({ error: "Unsupported file type." }, { status: 400 });
  if (folder === "gallery" && (!Number.isInteger(index) || index < 0 || index > 9)) {
    return Response.json({ error: "Invalid gallery position." }, { status: 400 });
  }

  const filename = folder === "gallery" ? `gallery-${index + 1}.${extension}` : folder === "thumbnail" ? `thumbnail.${extension}` : `printable.${extension}`;
  const path = `/lvo-files/${user.id}/${uploadGroup}/${filename}`;
  try {
    const { link } = await createDropboxUploadLink(path);
    return Response.json({ path, uploadUrl: link });
  } catch (error) {
    console.error("Unable to create Dropbox upload link", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to prepare Dropbox upload." }, { status: 500 });
  }
}
