import { redirect } from "next/navigation";

import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { AddTemplateForm } from "./add-template-form";

export const dynamic = "force-dynamic";

export default async function AddTemplatePage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!canUserAddTemplates(user)) redirect("/");

  const { data: categories } = await supabase
    .from("template_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return <AddTemplateForm categories={categories ?? []} userId={user.id} />;
}
