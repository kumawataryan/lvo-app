import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublishedTemplate, TemplateDifficulty, TemplateListFilters } from "@/lib/templates/types";

type TemplateRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  duration_minutes: number;
  difficulty: TemplateDifficulty;
  video_path: string;
  thumbnail_path: string | null;
  printable_path: string | null;
  is_featured: boolean;
  sort_order: number;
  published_at: string;
  category: { id: string; name: string; slug: string };
  gallery_images: Array<{ id: string; storage_path: string; alt_text: string; sort_order: number }>;
  template_supplies: Array<{
    quantity: string | null;
    notes: string | null;
    sort_order: number;
    supply: { id: string; name: string; icon: string | null };
  }>;
};

const templateSelection = `
  id,
  slug,
  title,
  short_description,
  duration_minutes,
  difficulty,
  video_path,
  thumbnail_path,
  printable_path,
  is_featured,
  sort_order,
  published_at,
  category:template_categories!inner(id, name, slug),
  gallery_images:template_gallery_images(id, storage_path, alt_text, sort_order),
  template_supplies(quantity, notes, sort_order, supply:supplies(id, name, icon))
`;

function publicMediaUrl(path: string | null) {
  if (!path) return null;
  const supabase = createSupabaseServerClient();
  return supabase.storage.from("template-media").getPublicUrl(path).data.publicUrl;
}

function mapTemplate(row: TemplateRow): PublishedTemplate {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    durationMinutes: row.duration_minutes,
    difficulty: row.difficulty,
    videoUrl: publicMediaUrl(row.video_path)!,
    thumbnailUrl: publicMediaUrl(row.thumbnail_path),
    hasPrintable: Boolean(row.printable_path),
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    publishedAt: row.published_at,
    category: row.category,
    galleryImages: [...row.gallery_images]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({ id: image.id, url: publicMediaUrl(image.storage_path)!, altText: image.alt_text, sortOrder: image.sort_order })),
    supplies: [...row.template_supplies]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({ ...item.supply, quantity: item.quantity, notes: item.notes, sortOrder: item.sort_order })),
  };
}

export async function listPublishedTemplates(filters: TemplateListFilters = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("templates")
    .select(templateSelection)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });

  if (filters.category) query = query.eq("template_categories.slug", filters.category);
  if (filters.featured !== undefined) query = query.eq("is_featured", filters.featured);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  query = query.limit(Math.min(Math.max(filters.limit ?? 50, 1), 100));

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load templates: ${error.message}`);
  return (data as unknown as TemplateRow[]).map(mapTemplate);
}

export async function getPublishedTemplateBySlug(slug: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("templates")
    .select(templateSelection)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`Unable to load template: ${error.message}`);
  return data ? mapTemplate(data as unknown as TemplateRow) : null;
}
