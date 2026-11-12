import { redirect } from "next/navigation";

import { isTemplateAdmin } from "@/lib/auth/permissions";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { affiliateImageUrl } from "@/lib/templates/repository";
import { AffiliateProductsScreen, type AdminAffiliateProduct } from "./affiliate-products-screen";

export const dynamic = "force-dynamic";

export default async function AffiliateProductsPage() {
  const authClient = await createSupabaseAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");
  if (!isTemplateAdmin(user)) redirect("/");

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("affiliate_products")
    .select("id, name, short_name, image_path, affiliate_url, sort_order, is_active")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Unable to load affiliate products: ${error.message}`);

  const products: AdminAffiliateProduct[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    imagePath: row.image_path,
    imageUrl: affiliateImageUrl(row.image_path),
    affiliateUrl: row.affiliate_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }));

  const purchase = await getActivePurchase(authClient, user.id).catch(() => null);

  return <AffiliateProductsScreen initialProducts={products} userId={user.id} subscribed={Boolean(purchase)} />;
}
