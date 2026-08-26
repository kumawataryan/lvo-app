import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { TemplateDetailClient } from "./template-detail-client";

export const dynamic = "force-dynamic";

export default async function TemplatePage() {
  if (!isSupabaseConfigured()) return <TemplateDetailClient subscribed={false} />;

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const subscribed = user ? await hasActiveSubscription(supabase, user.id).catch(() => false) : false;

  return <TemplateDetailClient subscribed={subscribed} />;
}
