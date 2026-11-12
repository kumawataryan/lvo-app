import "server-only";

import { unstable_cache } from "next/cache";

import { getPublishedTemplateById, getPublishedTemplateBySlug, getTemplateCategoryBySlug, getTemplateCategoryTrail, listPublishedTemplates, listRootTemplateCategories, listTemplateSubcategories } from "./repository";
import { DEFAULT_TEMPLATE_CATEGORIES } from "./types";

// Public (non-user-specific) template data, shared across requests. Invalidated by revalidateTag("templates", "max") on writes.
export const getCachedTemplates = unstable_cache(
  async () => listPublishedTemplates().catch((error) => {
    console.error("Failed to preload templates", error);
    return [];
  }),
  ["published-templates"],
  { revalidate: 60, tags: ["templates"] },
);

export const getCachedCategories = unstable_cache(
  async () => listRootTemplateCategories().catch((error) => {
    console.error("Failed to preload template categories", error);
    return DEFAULT_TEMPLATE_CATEGORIES;
  }),
  ["root-categories"],
  { revalidate: 300, tags: ["templates"] },
);

export const getCachedCategoryPage = unstable_cache(
  async (slug: string) => {
    const category = await getTemplateCategoryBySlug(slug).catch(() => null);
    if (!category) return null;
    const subcategories = await listTemplateSubcategories(category.id).catch(() => []);
    const [parentTemplates, ...subcategoryResults] = await Promise.all([
      listPublishedTemplates({ category: slug }).catch(() => []),
      ...subcategories.map((subcategory) => listPublishedTemplates({ category: subcategory.slug }).catch(() => [])),
    ]);
    const subcategoryTemplates = Object.fromEntries(
      subcategories.map((subcategory, index) => [subcategory.slug, subcategoryResults[index] ?? []]),
    );
    const templates = Array.from(
      new Map([...parentTemplates, ...subcategoryResults.flat()].map((template) => [template.id, template])).values(),
    );
    return { category, subcategories, templates, subcategoryTemplates };
  },
  ["category-page"],
  { revalidate: 60, tags: ["templates"] },
);

const RELATED_TEMPLATE_LIMIT = 49;

export const getCachedTemplateContent = unstable_cache(
  async (slug: string) => {
    const template = await getPublishedTemplateBySlug(slug).catch(() => null);
    if (!template) return null;
    const [relatedResult, categoryTrail] = await Promise.all([
      listPublishedTemplates({ category: template.category.slug, limit: RELATED_TEMPLATE_LIMIT }).catch(() => []),
      getTemplateCategoryTrail(template.category.id).catch(() => null),
    ]);
    return { template, related: relatedResult.filter((item) => item.id !== template.id), categoryTrail };
  },
  ["template-content"],
  { revalidate: 60, tags: ["templates"] },
);

// Resolves an old id-based link to the template's current slug (null if it is no longer published).
export const getCachedTemplateSlugById = unstable_cache(
  async (id: string) => {
    const template = await getPublishedTemplateById(id).catch(() => null);
    return template?.slug ?? null;
  },
  ["template-slug-by-id"],
  { revalidate: 60, tags: ["templates"] },
);
