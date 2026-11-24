import "server-only";

import { moveDropboxFile } from "@/lib/dropbox/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/templates/slug";

/** "Paper Flower!" + "pdf" → "paper-flower.pdf"; falls back to "printable.pdf" when the name has no usable characters. */
export function printableFilename(name: string, extension: string) {
  return `${slugify(name).slice(0, 80).replace(/-+$/g, "") || "printable"}.${extension}`;
}

/**
 * Renames a template's Dropbox printable to match its final slug (e.g. after the slug became "-2",
 * or for older files saved as "printable.pdf"), then points the template at the new path.
 * Meant to run after the response is sent, so it never slows down saving. Failures only log:
 * the file keeps working under its old name.
 */
export async function renamePrintableToSlug(templateId: string, printablePath: string | null | undefined, slug: string) {
  if (!printablePath?.startsWith("/lvo-files/")) return;
  const slash = printablePath.lastIndexOf("/");
  const currentName = printablePath.slice(slash + 1);
  const extension = currentName.includes(".") ? currentName.split(".").pop()!.toLowerCase() : "pdf";
  const targetPath = `${printablePath.slice(0, slash)}/${printableFilename(slug, extension)}`;
  if (targetPath === printablePath) return;

  try {
    await moveDropboxFile(printablePath, targetPath);
  } catch (error) {
    console.error("Unable to rename printable to match the slug", { templateId, printablePath, targetPath, error });
    return;
  }

  // Only repoint if the template still uses the old file (it may have been edited again meanwhile).
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("templates")
    .update({ printable_path: targetPath })
    .eq("id", templateId)
    .eq("printable_path", printablePath)
    .select("id");
  if (error || !data?.length) {
    // The template moved on; put the file back so nothing points at a missing path.
    console.error("Printable renamed but template not updated; moving it back", { templateId, error });
    await moveDropboxFile(targetPath, printablePath).catch((moveBackError) => console.error("Unable to move printable back", moveBackError));
  }
}
