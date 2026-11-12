import { isTemplateAdmin } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { parseAffiliateProductInput } from "@/lib/templates/affiliate-validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  if (!isTemplateAdmin(user)) return { error: Response.json({ error: "Only admins can manage affiliate products." }, { status: 403 }) };
  return { supabase, user };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Invalid product." }, { status: 400 });
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = parseAffiliateProductInput(body, auth.user.id);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const { value } = parsed;
  const { error } = await auth.supabase
    .from("affiliate_products")
    .update({
      name: value.name,
      short_name: value.shortName,
      image_path: value.imagePath,
      affiliate_url: value.affiliateUrl,
      sort_order: value.sortOrder,
      is_active: value.isActive,
    })
    .eq("id", id);

  if (error) {
    console.error("Unable to update affiliate product", error);
    return Response.json({ error: "Could not save this product." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Invalid product." }, { status: 400 });
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { error } = await auth.supabase.from("affiliate_products").delete().eq("id", id);
  if (error) {
    console.error("Unable to delete affiliate product", error);
    return Response.json({ error: "Could not delete this product." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
