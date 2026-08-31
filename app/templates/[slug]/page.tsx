import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { TemplateDetailClient } from "./template-detail-client";
import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TemplatePage() {
  if (!isSupabaseConfigured()) return <TemplateDetailClient subscribed={false} />;

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (user) {
    const onboarding = await getFamilyOnboarding(supabase, user.id).catch(() => null);
    if (!onboarding?.completed) redirect("/onboarding");
  }
  const subscribed = user ? await hasActiveSubscription(supabase, user.id).catch(() => false) : false;

  return <TemplateDetailClient subscribed={subscribed} />;
}
