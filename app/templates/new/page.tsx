import { redirect } from "next/navigation";

import { canUserAddTemplates } from "@/lib/auth/permissions";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { AddTemplateForm } from "./add-template-form";

export const dynamic = "force-dynamic";

export default async function AddTemplatePage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!canUserAddTemplates(user)) redirect("/");

  const [{ data: categories }, purchase] = await Promise.all([
    supabase
      .from("template_categories")
      .select("id, name, parent_id")
      .eq("is_active", true)
      .order("sort_order"),
    getActivePurchase(supabase, user.id).catch(() => null),
  ]);

  return <AddTemplateForm
    categories={(categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parent_id,
    }))}
    subscribed={Boolean(purchase)}
  />;
}
