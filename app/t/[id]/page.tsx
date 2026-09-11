import { notFound, redirect } from "next/navigation";

import { TemplateDetailClient } from "@/app/templates/[slug]/template-detail-client";
import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getPublishedTemplateById } from "@/lib/templates/repository";

export const dynamic = "force-dynamic";

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
  return <TemplateDetailClient subscribed={subscribed} initialTemplate={template} />;
}
