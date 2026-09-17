import { canUserAddTemplates } from "@/lib/auth/permissions";
import { deleteDropboxFile } from "@/lib/dropbox/server";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { parseVideoEmbedUrl } from "@/lib/templates/video-embed";

type UpdateTemplateBody = {
  title?: unknown;
  description?: unknown;
  categoryIds?: unknown;
  minimumAge?: unknown;
  maximumAge?: unknown;
  durationMinutes?: unknown;
  difficulty?: unknown;
  videoUrl?: unknown;
  thumbnailPath?: unknown;
  printablePath?: unknown;
  isFree?: unknown;
  galleryPaths?: unknown;
  supplies?: unknown;
  tags?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIFFICULTIES = new Set(["easy", "medium", "advanced"]);

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = await params;
  if (!UUID_PATTERN.test(templateId)) return Response.json({ error: "Invalid template." }, { status: 400 });

  const authClient = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "You do not have permission to edit templates." }, { status: 403 });

  const supabase = createSupabaseServiceRoleClient();

  const { data: existing, error: existingError } = await supabase
    .from("templates")
    .select("id, created_by")
    .eq("id", templateId)
    .maybeSingle();
  if (existingError) return Response.json({ error: existingError.message }, { status: 500 });
  if (!existing || existing.created_by !== user.id) return Response.json({ error: "Template not found." }, { status: 404 });

  let body: UpdateTemplateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const categoryIds = Array.isArray(body.categoryIds)
    ? [...new Set(body.categoryIds.filter((id): id is string => typeof id === "string"))].slice(0, 20)
    : [];
  const minimumAge = Number(body.minimumAge);
  const maximumAge = Number(body.maximumAge);
  const durationMinutes = Number(body.durationMinutes);
  const difficulty = typeof body.difficulty === "string" ? body.difficulty : "";
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  const thumbnailPath = typeof body.thumbnailPath === "string" ? body.thumbnailPath : "";
  const printablePath = typeof body.printablePath === "string" ? body.printablePath : "";
  const isFree = body.isFree === true;
  const galleryPaths = Array.isArray(body.galleryPaths) ? body.galleryPaths.filter((path): path is string => typeof path === "string").slice(0, 10) : [];
  const supplies = Array.isArray(body.supplies)
    ? [...new Set(body.supplies.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 20)
    : [];
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
    : [];
  const dropboxOwnedPrefix = `/lvo-files/${user.id}/`;
  const mediaOwnedPrefix = `${user.id}/`;
  const isOwnedMediaPath = (path: string) => path.startsWith(dropboxOwnedPrefix) || path.startsWith(mediaOwnedPrefix);

  if (!title || title.length > 120) return Response.json({ error: "Add a title under 120 characters." }, { status: 400 });
  if (description.length > 280) return Response.json({ error: "Keep the description under 280 characters." }, { status: 400 });
  if (!categoryIds.length || categoryIds.some((id) => !UUID_PATTERN.test(id))) return Response.json({ error: "Choose at least one category." }, { status: 400 });
  if (!Number.isInteger(minimumAge) || !Number.isInteger(maximumAge) || minimumAge < 0 || maximumAge > 18 || minimumAge > maximumAge) {
    return Response.json({ error: "Enter a valid age range from 0 to 18." }, { status: 400 });
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) return Response.json({ error: "Enter a valid duration." }, { status: 400 });
  if (!DIFFICULTIES.has(difficulty)) return Response.json({ error: "Choose a difficulty." }, { status: 400 });
  if (!videoUrl && !thumbnailPath && !galleryPaths.length) return Response.json({ error: "Add a template video or a featured image." }, { status: 400 });
  if (videoUrl && !parseVideoEmbedUrl(videoUrl)) return Response.json({ error: "Paste a valid YouTube Shorts link." }, { status: 400 });
  if (thumbnailPath && !isOwnedMediaPath(thumbnailPath)) return Response.json({ error: "Upload a featured image." }, { status: 400 });
  if (!printablePath.startsWith(dropboxOwnedPrefix)) return Response.json({ error: "Upload a printable PDF." }, { status: 400 });
  if (galleryPaths.some((path) => !isOwnedMediaPath(path))) return Response.json({ error: "Invalid gallery file." }, { status: 400 });

  const { data: validCategories, error: categoriesError } = await supabase
    .from("template_categories")
    .select("id")
    .in("id", categoryIds)
    .eq("is_active", true);
  if (categoriesError || (validCategories ?? []).length !== categoryIds.length) {
    return Response.json({ error: "Choose valid categories." }, { status: 400 });
  }

  const { error: updateError } = await supabase.from("templates").update({
    title,
    short_description: description,
    duration_minutes: durationMinutes,
    difficulty,
    minimum_age: minimumAge,
    maximum_age: maximumAge,
    video_embed_url: videoUrl || null,
    printable_path: printablePath,
    is_free: isFree,
    thumbnail_path: thumbnailPath || galleryPaths[0] || null,
  }).eq("id", templateId);
  if (updateError) return Response.json({ error: updateError.message }, { status: 400 });

  try {
    const { error: deleteCategoriesError } = await supabase.from("template_category_assignments").delete().eq("template_id", templateId);
    if (deleteCategoriesError) throw deleteCategoriesError;
    const { error: categoryLinksError } = await supabase.from("template_category_assignments").insert(
      categoryIds.map((categoryId, index) => ({
        template_id: templateId,
        category_id: categoryId,
        is_primary: index === 0,
        sort_order: index * 10,
      })),
    );
    if (categoryLinksError) throw categoryLinksError;

    const { error: deleteGalleryError } = await supabase.from("template_gallery_images").delete().eq("template_id", templateId);
    if (deleteGalleryError) throw deleteGalleryError;
    if (galleryPaths.length) {
      const { error } = await supabase.from("template_gallery_images").insert(
        galleryPaths.map((storagePath, index) => ({
          template_id: templateId,
          storage_path: storagePath,
          alt_text: `${title} image ${index + 1}`,
          sort_order: (index + 1) * 10,
        })),
      );
      if (error) throw error;
    }

    const { error: deleteSuppliesError } = await supabase.from("template_supplies").delete().eq("template_id", templateId);
    if (deleteSuppliesError) throw deleteSuppliesError;
    if (supplies.length) {
      const { data: existingSupplies, error: selectError } = await supabase.from("supplies").select("id, name").in("name", supplies);
      if (selectError) throw selectError;
      const existingNames = new Set((existingSupplies ?? []).map((item) => item.name));
      const missing = supplies.filter((name) => !existingNames.has(name));
      if (missing.length) {
        const { error } = await supabase.from("supplies").insert(missing.map((name) => ({ name })));
        if (error && error.code !== "23505") throw error;
      }
      const { data: allSupplies, error: suppliesError } = await supabase.from("supplies").select("id, name").in("name", supplies);
      if (suppliesError) throw suppliesError;
      const byName = new Map((allSupplies ?? []).map((item) => [item.name, item.id]));
      const links = supplies.flatMap((name, index) => {
        const supplyId = byName.get(name);
        return supplyId ? [{ template_id: templateId, supply_id: supplyId, sort_order: (index + 1) * 10 }] : [];
      });
      if (links.length) {
        const { error } = await supabase.from("template_supplies").insert(links);
        if (error) throw error;
      }
    }

    const { error: deleteTagsError } = await supabase.from("template_tag_assignments").delete().eq("template_id", templateId);
    if (deleteTagsError) throw deleteTagsError;
    if (tags.length) {
      const tagRows = tags.map((name) => ({ name, slug: slugify(name) })).filter(({ slug }) => slug);
      const { error: tagUpsertError } = await supabase.from("template_tags").upsert(tagRows, { onConflict: "slug", ignoreDuplicates: true });
      if (tagUpsertError) throw tagUpsertError;
      const { data: savedTags, error: tagsError } = await supabase.from("template_tags").select("id, slug").in("slug", tagRows.map(({ slug }) => slug));
      if (tagsError) throw tagsError;
      const { error: tagLinksError } = await supabase.from("template_tag_assignments").insert(
        (savedTags ?? []).map((tag) => ({ template_id: templateId, tag_id: tag.id })),
      );
      if (tagLinksError) throw tagLinksError;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save template details." }, { status: 400 });
  }

  return Response.json({ id: templateId }, { status: 200 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = await params;
  if (!UUID_PATTERN.test(templateId)) return Response.json({ error: "Invalid template." }, { status: 400 });

  const authClient = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "You do not have permission to delete templates." }, { status: 403 });

  const supabase = createSupabaseServiceRoleClient();

  const { data: existing, error: existingError } = await supabase
    .from("templates")
    .select("id, created_by, printable_path, thumbnail_path, gallery_images:template_gallery_images(storage_path)")
    .eq("id", templateId)
    .maybeSingle();
  if (existingError) return Response.json({ error: existingError.message }, { status: 500 });
  if (!existing || existing.created_by !== user.id) return Response.json({ error: "Template not found." }, { status: 404 });

  const { error: deleteError } = await supabase.from("templates").delete().eq("id", templateId);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 400 });

  const dropboxPaths: string[] = [];
  const supabasePaths: string[] = [];
  const trackPath = (path: string | null | undefined) => {
    if (!path) return;
    if (path.startsWith("/lvo-files/")) dropboxPaths.push(path);
    else supabasePaths.push(path);
  };
  trackPath(existing.printable_path);
  trackPath(existing.thumbnail_path);
  for (const image of existing.gallery_images ?? []) trackPath(image.storage_path);

  await Promise.all([
    Promise.allSettled(dropboxPaths.map(deleteDropboxFile)),
    supabasePaths.length ? supabase.storage.from("template-media").remove(supabasePaths) : Promise.resolve(),
  ]).catch(() => undefined);

  return Response.json({ ok: true });
}
