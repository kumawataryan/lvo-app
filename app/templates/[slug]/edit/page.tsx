import { notFound, redirect } from "next/navigation";

import { canManageTemplate, canUserAddTemplates } from "@/lib/auth/permissions";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listActiveAffiliateProducts, publicMediaUrl } from "@/lib/templates/repository";
import { AddTemplateForm, type InitialTemplateData } from "@/app/templates/new/add-template-form";

export const dynamic = "force-dynamic";

type EditTemplateRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
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
  template_specs: Array<{ label: string; value: string; sort_order: number }>;
  template_affiliate_products: Array<{ sort_order: number; affiliate_product_id: string }>;
  tag_assignments: Array<{ tag: { name: string } | null }>;
};

export default async function EditTemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: templateId } = await params;

  const authClient = await createSupabaseAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");
  if (!canUserAddTemplates(user)) redirect("/");

  const supabase = createSupabaseServiceRoleClient();

  const [{ data: templateRow }, { data: categories }, purchase, affiliateOptions] = await Promise.all([
    supabase
      .from("templates")
      .select(`
        id, title, slug, status, short_description, minimum_age, maximum_age, duration_minutes, difficulty,
        video_embed_url, printable_path, thumbnail_path, is_free, created_by,
        category_assignments:template_category_assignments(category_id, is_primary, sort_order),
        gallery_images:template_gallery_images(storage_path, sort_order),
        template_supplies(sort_order, supply:supplies(name)),
        template_specs(label, value, sort_order),
        template_affiliate_products(sort_order, affiliate_product_id),
        tag_assignments:template_tag_assignments(tag:template_tags(name))
      `)
      .eq("id", templateId)
      .maybeSingle(),
    supabase.from("template_categories").select("id, name, parent_id").eq("is_active", true).order("sort_order"),
    getActivePurchase(authClient, user.id).catch(() => null),
    listActiveAffiliateProducts().catch(() => []),
  ]);

  const template = templateRow as unknown as EditTemplateRow | null;
  if (!template || !canManageTemplate(user, template.created_by)) notFound();

  const galleryPaths = [...(template.gallery_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => image.storage_path);
  const orderedImagePaths = template.thumbnail_path
    ? [template.thumbnail_path, ...galleryPaths.filter((path) => path !== template.thumbnail_path)]
    : galleryPaths;

  const initialData: InitialTemplateData = {
    id: template.id,
    title: template.title,
    slug: template.slug,
    status: template.status,
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
    specs: [...(template.template_specs ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((spec) => ({ label: spec.label, value: spec.value })),
    affiliateProductIds: [...(template.template_affiliate_products ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((link) => link.affiliate_product_id),
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
      affiliateOptions={affiliateOptions}
      initialData={initialData}
    />
  );
}
