import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALL_TEMPLATE_CATEGORIES, DEFAULT_TEMPLATE_CATEGORIES, type PublishedTemplate, type TemplateCategory, type TemplateDifficulty, type TemplateListFilters } from "@/lib/templates/types";

type TemplateRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  duration_minutes: number;
  minimum_age?: number | null;
  maximum_age?: number | null;
  difficulty: TemplateDifficulty;
  video_path: string | null;
  video_embed_url: string | null;
  thumbnail_path: string | null;
  printable_path: string | null;
  is_featured: boolean;
  is_free: boolean;
  sort_order: number;
  published_at: string;
  category?: { id: string; name: string; slug: string };
  category_assignments?: Array<{
    is_primary: boolean;
    sort_order: number;
    category: { id: string; name: string; slug: string };
  }>;
  gallery_images: Array<{ id: string; storage_path: string; alt_text: string; sort_order: number }>;
  template_supplies: Array<{
    quantity: string | null;
    notes: string | null;
    sort_order: number;
    supply: { id: string; name: string; icon: string | null };
  }>;
  tag_assignments?: Array<{ tag: { id: string; name: string; slug: string } }>;
};

export type TemplateTag = { id: string; name: string; slug: string };

const templateBaseFields = `
  id,
  slug,
  title,
  short_description,
  duration_minutes,
  difficulty,
  video_path,
  video_embed_url,
  thumbnail_path,
  printable_path,
  is_featured,
  is_free,
  sort_order,
  published_at,
`;

const templateFields = `${templateBaseFields}
  minimum_age,
  maximum_age,
`;

const templateRelations = `
  gallery_images:template_gallery_images(id, storage_path, alt_text, sort_order),
  template_supplies(quantity, notes, sort_order, supply:supplies(id, name, icon)),
  tag_assignments:template_tag_assignments(tag:template_tags(id, name, slug))
`;

const templateSelection = `${templateFields}
  category_assignments:template_category_assignments!inner(
    is_primary,
    sort_order,
    category:template_categories!inner(id, name, slug)
  ),
  ${templateRelations}
`;

const legacyTemplateSelection = `${templateFields}
  category:template_categories!inner(id, name, slug),
  ${templateRelations}
`;

const templateSelectionWithoutAge = `${templateBaseFields}
  category_assignments:template_category_assignments!inner(
    is_primary,
    sort_order,
    category:template_categories!inner(id, name, slug)
  ),
  ${templateRelations}
`;

const legacyTemplateSelectionWithoutAge = `${templateBaseFields}
  category:template_categories!inner(id, name, slug),
  ${templateRelations}
`;

export function publicMediaUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("/lvo-files/")) return `/api/dropbox/content?path=${encodeURIComponent(path)}`;
  const supabase = createSupabaseServerClient();
  return supabase.storage.from("template-media").getPublicUrl(path).data.publicUrl;
}

function mapTemplate(row: TemplateRow): PublishedTemplate {
  const category = [...(row.category_assignments ?? [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]?.category ?? row.category;

  if (!category) throw new Error(`Template ${row.slug} has no category assignment.`);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    durationMinutes: row.duration_minutes,
    minimumAge: row.minimum_age ?? null,
    maximumAge: row.maximum_age ?? null,
    difficulty: row.difficulty,
    videoUrl: publicMediaUrl(row.video_path),
    videoEmbedUrl: row.video_embed_url,
    thumbnailUrl: publicMediaUrl(row.thumbnail_path),
    hasPrintable: Boolean(row.printable_path),
    printableIsZip: (row.printable_path?.split(".").pop()?.toLowerCase() ?? "") === "zip",
    isFree: row.is_free,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    publishedAt: row.published_at,
    category,
    galleryImages: [...row.gallery_images]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({ id: image.id, url: publicMediaUrl(image.storage_path)!, altText: image.alt_text, sortOrder: image.sort_order })),
    supplies: [...row.template_supplies]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({ ...item.supply, quantity: item.quantity, notes: item.notes, sortOrder: item.sort_order })),
    tags: (row.tag_assignments ?? []).map(({ tag }) => tag.name).sort((a, b) => a.localeCompare(b)),
  };
}

export async function listRootTemplateCategories(): Promise<TemplateCategory[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("template_categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .in("slug", DEFAULT_TEMPLATE_CATEGORIES.map((category) => category.slug))
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Unable to load template categories: ${error.message}`);
  const categoriesBySlug = new Map((data ?? []).map((category) => [category.slug, category]));

  return DEFAULT_TEMPLATE_CATEGORIES.map((fallback) => {
    const category = categoriesBySlug.get(fallback.slug);
    return category ? { ...fallback, id: category.id, name: category.name } : fallback;
  });
}

export async function getTemplateCategoryBySlug(slug: string): Promise<TemplateCategory | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("template_categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Unable to load template category: ${error.message}`);
  if (!data) return null;
  const fallback = ALL_TEMPLATE_CATEGORIES.find((category) => category.slug === data.slug);
  return { id: data.id, name: data.name, slug: data.slug, icon: fallback?.icon };
}

export async function getTemplateTagBySlug(slug: string): Promise<TemplateTag | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("template_tags").select("id, name, slug").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Unable to load template tag: ${error.message}`);
  return data as TemplateTag | null;
}

export async function listPublishedTemplatesByTag(tagSlug: string, options: { offset?: number; limit?: number } = {}) {
  const supabase = createSupabaseServerClient();
  const offset = Math.max(options.offset ?? 0, 0);
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 100);
  const taggedSelection = templateSelection
    .replace("tag_assignments:template_tag_assignments(", "tag_assignments:template_tag_assignments!inner(")
    .replace("tag:template_tags(id, name, slug)", "tag:template_tags!inner(id, name, slug)");
  const { data, error, count } = await supabase
    .from("templates")
    .select(taggedSelection, { count: "exact" })
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .eq("tag_assignments.tag.slug", tagSlug)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Unable to load tagged templates: ${error.message}`);
  return { templates: (data as unknown as TemplateRow[]).map(mapTemplate), total: count ?? 0 };
}

export async function listTemplateSubcategories(parentId: string): Promise<TemplateCategory[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("template_categories")
    .select("id, name, slug, parent_id")
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Unable to load template subcategories: ${error.message}`);
  return (data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parent_id,
  }));
}

export async function listPublishedTemplates(filters: TemplateListFilters = {}) {
  const supabase = createSupabaseServerClient();
  if (filters.search) {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const { data: matches, error: searchError } = await supabase.rpc("search_published_templates", {
      search_query: filters.search,
      result_limit: limit,
      category_slug: filters.category ?? null,
      featured_only: filters.featured ?? null,
    });
    if (searchError) throw new Error(`Unable to search templates: ${searchError.message}`);
    const rankedIds = (matches ?? []).map((match: { template_id: string }) => match.template_id);
    if (!rankedIds.length) return [];

    const { data, error } = await supabase
      .from("templates")
      .select(templateSelection)
      .in("id", rankedIds)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());
    if (error) throw new Error(`Unable to load search results: ${error.message}`);
    const rank = new Map(rankedIds.map((id: string, index: number) => [id, index]));
    return (data as unknown as TemplateRow[])
      .map(mapTemplate)
      .sort((a, b) => (rank.get(a.id) ?? rankedIds.length) - (rank.get(b.id) ?? rankedIds.length));
  }

  const execute = (selection: string, categoryPath: string) => {
    let query = supabase
      .from("templates")
      .select(selection)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false });

    if (filters.category) query = query.eq(categoryPath, filters.category);
    if (filters.featured !== undefined) query = query.eq("is_featured", filters.featured);
    return query.limit(Math.min(Math.max(filters.limit ?? 50, 1), 100));
  };

  let { data, error } = await execute(templateSelection, "category_assignments.category.slug");
  if (error) ({ data, error } = await execute(templateSelectionWithoutAge, "category_assignments.category.slug"));
  if (error) ({ data, error } = await execute(legacyTemplateSelection, "template_categories.slug"));
  if (error) ({ data, error } = await execute(legacyTemplateSelectionWithoutAge, "template_categories.slug"));
  if (error) throw new Error(`Unable to load templates: ${error.message}`);
  return (data as unknown as TemplateRow[]).map(mapTemplate);
}

export async function getPublishedTemplateBySlug(slug: string) {
  const supabase = createSupabaseServerClient();
  let { data, error } = await supabase
    .from("templates")
    .select(templateSelection)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    ({ data, error } = await supabase
      .from("templates")
      .select(templateSelectionWithoutAge)
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle());
  }

  if (error) {
    ({ data, error } = await supabase
      .from("templates")
      .select(legacyTemplateSelection)
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle());
  }

  if (error) {
    ({ data, error } = await supabase
      .from("templates")
      .select(legacyTemplateSelectionWithoutAge)
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle());
  }

  if (error) throw new Error(`Unable to load template: ${error.message}`);
  return data ? mapTemplate(data as unknown as TemplateRow) : null;
}

export async function getPublishedTemplateById(id: string) {
  const supabase = createSupabaseServerClient();
  const execute = (selection: string) => supabase
    .from("templates")
    .select(selection)
    .eq("id", id)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  let { data, error } = await execute(templateSelection);
  if (error) ({ data, error } = await execute(templateSelectionWithoutAge));
  if (error) ({ data, error } = await execute(legacyTemplateSelection));
  if (error) ({ data, error } = await execute(legacyTemplateSelectionWithoutAge));
  if (error) throw new Error(`Unable to load template: ${error.message}`);
  return data ? mapTemplate(data as unknown as TemplateRow) : null;
}
