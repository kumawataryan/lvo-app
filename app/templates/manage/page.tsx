import { redirect } from "next/navigation";

import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/templates/repository";
import { ManageTemplatesScreen } from "./manage-templates-screen";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ManageTemplatesPage() {
  const authClient = await createSupabaseAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");
  if (!canUserAddTemplates(user)) redirect("/");

  const supabase = createSupabaseServiceRoleClient();
  const { data: rows, count } = await supabase
    .from("templates")
    .select("id, title, status, thumbnail_path, updated_at", { count: "exact" })
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const templates = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as "draft" | "published" | "archived",
    thumbnailUrl: publicMediaUrl(row.thumbnail_path),
    updatedAt: row.updated_at as string,
  }));

  return <ManageTemplatesScreen initialTemplates={templates} initialHasMore={templates.length < (count ?? 0)} pageSize={PAGE_SIZE} />;
}
