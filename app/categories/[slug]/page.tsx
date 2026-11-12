import { notFound, redirect } from "next/navigation";

import { CategoryDetailScreen } from "@/components/craft-app";
import { getSessionUser } from "@/lib/auth/session";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCachedCategoryPage } from "@/lib/templates/cached";
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
  const pagePromise = getCachedCategoryPage(slug);
  const purchasePromise = getSessionUser(supabase)
    .then((user) => (user ? getActivePurchase(supabase, user.id).catch(() => null) : null));
  const [data, purchase] = await Promise.all([pagePromise, purchasePromise]);

  const category = data?.category;
  if (!category) {
    // A catalog category that is now inactive or deleted goes back home; unknown slugs stay 404.
    if (fallbackCategory) redirect("/");
    notFound();
  }

  return <CategoryDetailScreen
    category={category}
    subcategories={data?.subcategories ?? []}
    initialTemplates={data?.templates ?? []}
    subcategoryTemplates={data?.subcategoryTemplates ?? {}}
    subscribed={Boolean(purchase)}
  />;
}
