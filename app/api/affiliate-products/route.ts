import { isTemplateAdmin } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { parseAffiliateProductInput } from "@/lib/templates/affiliate-validation";

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!isTemplateAdmin(user)) return Response.json({ error: "Only admins can manage affiliate products." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = parseAffiliateProductInput(body, user.id);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const { value } = parsed;
  const { data, error } = await supabase
    .from("affiliate_products")
    .insert({
      name: value.name,
      short_name: value.shortName,
      image_path: value.imagePath,
      affiliate_url: value.affiliateUrl,
      sort_order: value.sortOrder,
      is_active: value.isActive,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Unable to create affiliate product", error);
    return Response.json({ error: "Could not save this product." }, { status: 500 });
  }
  return Response.json({ id: data.id });
}
