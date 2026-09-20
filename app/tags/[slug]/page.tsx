import { notFound, redirect } from "next/navigation";

import { TagDetailScreen } from "./tag-detail-screen";
import { canUserAddTemplates } from "@/lib/auth/permissions";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getTemplateTagBySlug, listPublishedTemplatesByTag } from "@/lib/templates/repository";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 40;

export default async function TagPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const tag = await getTemplateTagBySlug(slug).catch(() => null);
  if (!tag) notFound();

  const [{ templates, total }, supabase] = await Promise.all([
    listPublishedTemplatesByTag(slug, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
    createSupabaseAuthServerClient(),
  ]);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  if (page > totalPages) redirect(`/tags/${slug}?page=${totalPages}`);
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const purchase = user ? await getActivePurchase(supabase, user.id).catch(() => null) : null;

  return <TagDetailScreen tag={tag} publishedTemplates={templates} subscribed={Boolean(purchase)} canAddTemplates={canUserAddTemplates(user)} page={page} total={total} pageSize={PAGE_SIZE} />;
}
