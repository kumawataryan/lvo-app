import { redirect } from "next/navigation";

import { SubscriptionScreen } from "./subscription-screen";
import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  if (!isSupabaseConfigured()) return <SubscriptionScreen />;

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const subscribed = user ? await hasActiveSubscription(supabase, user.id).catch(() => false) : false;
  if (subscribed) redirect("/");

  return <SubscriptionScreen />;
}
