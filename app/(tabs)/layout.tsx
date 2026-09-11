import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import AppShell from "@/components/craft-app";
import { canUserAddTemplates } from "@/lib/auth/permissions";
import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { getActivePurchase } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listPublishedTemplates, listRootTemplateCategories } from "@/lib/templates/repository";
import { DEFAULT_TEMPLATE_CATEGORIES } from "@/lib/templates/types";

export const dynamic = "force-dynamic";

export default async function TabsLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <AppShell initialCategories={DEFAULT_TEMPLATE_CATEGORIES}>{children}</AppShell>;
  }

  const supabase = await createSupabaseAuthServerClient();
  const [initialTemplates, initialCategories, { data: { user } }] = await Promise.all([
    listPublishedTemplates().catch((error) => {
      console.error("Failed to preload templates", error);
      return [];
    }),
    listRootTemplateCategories().catch((error) => {
      console.error("Failed to preload template categories", error);
      return DEFAULT_TEMPLATE_CATEGORIES;
    }),
    supabase.auth.getUser().catch(() => ({ data: { user: null } })),
  ]);

  const purchase = user ? await getActivePurchase(supabase, user.id).catch(() => null) : null;
  const subscribed = Boolean(purchase);

  let parentName = "";
  let profileKids: Array<{ id: string; name: string; birthYear: number; avatar: string }> = [];
  if (user) {
    const onboarding = await getFamilyOnboarding(supabase, user.id).catch(() => null);
    if (!onboarding?.completed) redirect("/onboarding");
    parentName = onboarding.parentName;
    profileKids = onboarding.kids.map(({ id, name, birthYear, avatar }) => ({ id, name, birthYear, avatar }));
  }

  return (
    <AppShell
      initialTemplates={initialTemplates}
      initialCategories={initialCategories}
      canAddTemplates={canUserAddTemplates(user)}
      subscribed={subscribed}
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
    >
      {children}
    </AppShell>
  );
}
