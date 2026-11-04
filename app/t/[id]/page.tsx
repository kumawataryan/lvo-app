import { notFound, redirect } from "next/navigation";

import { TemplateDetailClient } from "@/app/templates/[slug]/template-detail-client";
import { getSessionUser } from "@/lib/auth/session";
import { canUserAddTemplates } from "@/lib/auth/permissions";
import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getCachedTemplateContent } from "@/lib/templates/cached";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Content and account checks are independent; only related content needs the template first.
  const contentPromise = getCachedTemplateContent(id);
  const accountPromise = (async () => {
    const supabase = await createSupabaseAuthServerClient();
    const user = await getSessionUser(supabase);
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
