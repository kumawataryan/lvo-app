import { redirect } from "next/navigation";

import { SubscriptionScreen } from "./subscription-screen";
import { GATEWAYS, PLAN_ORDER, type Gateway, type PlanId } from "@/lib/payments/plans";
import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getFamilyOnboarding } from "@/lib/onboarding/server";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ plan?: string; gateway?: string }> }) {
  // Plan and gateway come back in the URL after login so the choice made before signing in is kept.
  const { plan, gateway } = await searchParams;
  const initialPlan = PLAN_ORDER.find((id): id is PlanId => id === plan);
  const initialGateway = GATEWAYS.find((item) => item.id === gateway)?.id as Gateway | undefined;
  const initialProps = { initialPlan, initialGateway: initialGateway ?? null };

  if (!isSupabaseConfigured()) return <SubscriptionScreen {...initialProps} />;

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const onboarding = await getFamilyOnboarding(supabase, user.id).catch(() => null);
    if (!onboarding?.completed) redirect("/onboarding");
  }
  const subscribed = user ? await hasActiveSubscription(supabase, user.id).catch(() => false) : false;
  if (subscribed) redirect("/");

  return <SubscriptionScreen {...initialProps} />;
}
