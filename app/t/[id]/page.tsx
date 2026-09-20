import { notFound, redirect } from "next/navigation";

import { TemplateDetailClient } from "@/app/templates/[slug]/template-detail-client";
import { canUserAddTemplates } from "@/lib/auth/permissions";
import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getPublishedTemplateById, getTemplateCategoryTrail, listPublishedTemplates } from "@/lib/templates/repository";

export const dynamic = "force-dynamic";

const RELATED_TEMPLATE_LIMIT = 49;

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getPublishedTemplateById(id).catch(() => null);
  if (!template) notFound();

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (user) {
    const onboarding = await getFamilyOnboarding(supabase, user.id).catch(() => null);
    if (!onboarding?.completed) redirect("/onboarding");
  }
  const subscribed = user ? await hasActiveSubscription(supabase, user.id).catch(() => false) : false;

  const relatedResult = await listPublishedTemplates({ category: template.category.slug, limit: RELATED_TEMPLATE_LIMIT }).catch(() => []);
  const related = relatedResult.filter((item) => item.id !== template.id);
  const categoryTrail = await getTemplateCategoryTrail(template.category.id).catch(() => null);

  return <TemplateDetailClient subscribed={subscribed} canAddTemplates={canUserAddTemplates(user)} initialTemplate={template} initialRelated={related} categoryTrail={categoryTrail} />;
}
