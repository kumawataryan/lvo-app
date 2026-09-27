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
  // Content and account checks are independent; only related content needs the template first.
  const contentPromise = (async () => {
    const template = await getPublishedTemplateById(id).catch(() => null);
    if (!template) return null;
    const [relatedResult, categoryTrail] = await Promise.all([
      listPublishedTemplates({ category: template.category.slug, limit: RELATED_TEMPLATE_LIMIT }).catch(() => []),
      getTemplateCategoryTrail(template.category.id).catch(() => null),
    ]);
    return { template, related: relatedResult.filter((item) => item.id !== template.id), categoryTrail };
  })();
  const accountPromise = (async () => {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const [onboarding, subscribed] = await Promise.all([
      user ? getFamilyOnboarding(supabase, user.id).catch(() => null) : null,
      user ? hasActiveSubscription(supabase, user.id).catch(() => false) : false,
    ]);
    return { user, onboarding, subscribed };
  })();
  const [content, { user, onboarding, subscribed }] = await Promise.all([contentPromise, accountPromise]);
  if (!content) notFound();
  if (user && !onboarding?.completed) redirect("/onboarding");
  const { template, related, categoryTrail } = content;

  return <TemplateDetailClient subscribed={subscribed} canAddTemplates={canUserAddTemplates(user)} initialTemplate={template} initialRelated={related} categoryTrail={categoryTrail} />;
}
