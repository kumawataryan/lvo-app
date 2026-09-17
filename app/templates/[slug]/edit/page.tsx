import { notFound, redirect } from "next/navigation";

import { canUserAddTemplates } from "@/lib/auth/permissions";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/templates/repository";
import { AddTemplateForm, type InitialTemplateData } from "@/app/templates/new/add-template-form";

export const dynamic = "force-dynamic";

type EditTemplateRow = {
  id: string;
  title: string;
  short_description: string | null;
  minimum_age: number | null;
  maximum_age: number | null;
  duration_minutes: number;
  difficulty: string;
  video_embed_url: string | null;
  printable_path: string | null;
  thumbnail_path: string | null;
  is_free: boolean;
  created_by: string | null;
  category_assignments: Array<{ category_id: string; is_primary: boolean; sort_order: number }>;
  gallery_images: Array<{ storage_path: string; sort_order: number }>;
  template_supplies: Array<{ sort_order: number; supply: { name: string } | null }>;
  tag_assignments: Array<{ tag: { name: string } | null }>;
};

export default async function EditTemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: templateId } = await params;

  const authClient = await createSupabaseAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");
  if (!canUserAddTemplates(user)) redirect("/");

  const supabase = createSupabaseServiceRoleClient();

  const [{ data: templateRow }, { data: categories }, purchase] = await Promise.all([
    supabase
      .from("templates")
      .select(`
        id, title, short_description, minimum_age, maximum_age, duration_minutes, difficulty,
        video_embed_url, printable_path, thumbnail_path, is_free, created_by,
        category_assignments:template_category_assignments(category_id, is_primary, sort_order),
        gallery_images:template_gallery_images(storage_path, sort_order),
        template_supplies(sort_order, supply:supplies(name)),
        tag_assignments:template_tag_assignments(tag:template_tags(name))
      `)
      .eq("id", templateId)
      .maybeSingle(),
    supabase.from("template_categories").select("id, name, parent_id").eq("is_active", true).order("sort_order"),
    getActivePurchase(authClient, user.id).catch(() => null),
  ]);

  const template = templateRow as unknown as EditTemplateRow | null;
  if (!template || template.created_by !== user.id) notFound();

  const galleryPaths = [...(template.gallery_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => image.storage_path);
  const orderedImagePaths = template.thumbnail_path
    ? [template.thumbnail_path, ...galleryPaths.filter((path) => path !== template.thumbnail_path)]
    : galleryPaths;

  const initialData: InitialTemplateData = {
    id: template.id,
    title: template.title,
    description: template.short_description ?? "",
    categoryIds: [...(template.category_assignments ?? [])]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
      .map((assignment) => assignment.category_id),
    minimumAge: template.minimum_age ?? 4,
    maximumAge: template.maximum_age ?? 8,
    durationMinutes: template.duration_minutes,
    difficulty: template.difficulty,
    videoUrl: template.video_embed_url ?? "",
    isFree: template.is_free,
    supplies: [...(template.template_supplies ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((item) => (item.supply ? [item.supply.name] : [])),
    tags: (template.tag_assignments ?? []).flatMap((assignment) => (assignment.tag ? [assignment.tag.name] : [])),
    printablePath: template.printable_path ?? "",
    images: orderedImagePaths.flatMap((path) => {
      const url = publicMediaUrl(path);
      return url ? [{ path, url }] : [];
    }),
  };

  return (
    <AddTemplateForm
      categories={(categories ?? []).map((category) => ({ id: category.id, name: category.name, parentId: category.parent_id }))}
      subscribed={Boolean(purchase)}
      initialData={initialData}
    />
  );
}
