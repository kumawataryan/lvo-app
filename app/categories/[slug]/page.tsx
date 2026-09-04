import { notFound } from "next/navigation";

import { CategoryDetailScreen } from "@/components/craft-app";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getTemplateCategoryBySlug, listPublishedTemplates, listTemplateSubcategories } from "@/lib/templates/repository";
import { ALL_TEMPLATE_CATEGORIES } from "@/lib/templates/types";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fallbackCategory = ALL_TEMPLATE_CATEGORIES.find((category) => category.slug === slug);

  if (!isSupabaseConfigured()) {
    if (!fallbackCategory) notFound();
    return <CategoryDetailScreen category={fallbackCategory} subcategories={[]} initialTemplates={[]} subcategoryTemplates={{}} />;
  }

  const supabase = await createSupabaseAuthServerClient();
  const [category, { data: { user } }] = await Promise.all([
    getTemplateCategoryBySlug(slug).catch(() => fallbackCategory ?? null),
    supabase.auth.getUser().catch(() => ({ data: { user: null } })),
  ]);

  if (!category) notFound();
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
  const purchase = user ? await getActivePurchase(supabase, user.id).catch(() => null) : null;

  return <CategoryDetailScreen
    category={category}
    subcategories={subcategories}
    initialTemplates={templates}
    subcategoryTemplates={subcategoryTemplates}
    subscribed={Boolean(purchase)}
  />;
}
