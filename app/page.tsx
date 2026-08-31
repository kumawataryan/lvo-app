import CraftApp from "@/components/craft-app";
import { canUserAddTemplates } from "@/lib/auth/permissions";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listPublishedTemplates } from "@/lib/templates/repository";
import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;

  if (!isSupabaseConfigured()) return <CraftApp initialTab={tab} />;

  const supabase = await createSupabaseAuthServerClient();
  const [initialTemplates, { data: { user } }] = await Promise.all([
    listPublishedTemplates().catch((error) => {
      console.error("Failed to preload templates", error);
      return [];
    }),
    supabase.auth.getUser().catch(() => ({ data: { user: null } })),
  ]);

  const purchase = user ? await getActivePurchase(supabase, user.id).catch(() => null) : null;
  const subscribed = Boolean(purchase);

  let parentName = "";
  let profileKids: Array<{ id: string; name: string; avatar: string }> = [];
  if (user) {
    const onboarding = await getFamilyOnboarding(supabase, user.id).catch(() => null);
    if (!onboarding?.completed) redirect("/onboarding");
    parentName = onboarding.parentName;
    profileKids = onboarding.kids.map(({ id, name, avatar }) => ({ id, name, avatar }));
  }

  return <CraftApp
    initialTemplates={initialTemplates}
    canAddTemplates={canUserAddTemplates(user)}
    subscribed={subscribed}
    initialTab={tab}
    parentName={parentName}
    subscription={purchase ? {
      planId: purchase.plan_id,
      billingType: purchase.billing_type,
      status: purchase.status,
      gateway: purchase.gateway,
      amount: purchase.amount,
      currency: purchase.currency,
      currentPeriodEnd: purchase.current_period_end,
      cancelAtPeriodEnd: purchase.cancel_at_period_end,
    } : null}
    profileKids={profileKids}
  />;
}
