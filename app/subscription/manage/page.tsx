import { redirect } from "next/navigation";

import { ManageSubscriptionScreen } from "./manage-screen";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getFamilyOnboarding } from "@/lib/onboarding/server";

export const dynamic = "force-dynamic";

export default async function ManageSubscriptionPage() {
  if (!isSupabaseConfigured()) redirect("/subscription");

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const onboarding = await getFamilyOnboarding(supabase, user.id).catch(() => null);
  if (!onboarding?.completed) redirect("/onboarding");

  const purchase = await getActivePurchase(supabase, user.id).catch(() => null);
  if (!purchase) redirect("/subscription");

  return <ManageSubscriptionScreen purchase={purchase} />;
}
