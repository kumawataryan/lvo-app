import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import AppShell from "@/components/craft-app";
import { getSessionUser } from "@/lib/auth/session";
import { canUserAddTemplates, isTemplateAdmin } from "@/lib/auth/permissions";
import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { getActivePurchase, hasActiveSubscription } from "@/lib/payments/repository";
import { isTrialOfferEligible } from "@/lib/trials/server";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCachedCategories, getCachedTemplates } from "@/lib/templates/cached";
import { DEFAULT_TEMPLATE_CATEGORIES } from "@/lib/templates/types";

export default async function TabsLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <AppShell initialCategories={DEFAULT_TEMPLATE_CATEGORIES}>{children}</AppShell>;
  }

  const supabase = await createSupabaseAuthServerClient();
  // Everything below runs in parallel: public data is cached, user data is fetched concurrently.
  const userPromise = getSessionUser(supabase);
  const purchasePromise = userPromise.then((user) => (user ? getActivePurchase(supabase, user.id).catch(() => null) : null));
  const onboardingPromise = userPromise.then((user) => (user ? getFamilyOnboarding(supabase, user.id).catch(() => null) : undefined));
  const [initialTemplates, initialCategories, user, purchase, onboarding] = await Promise.all([
    getCachedTemplates(),
    getCachedCategories(),
    userPromise,
    purchasePromise,
    onboardingPromise,
  ]);
  // Access comes from a paid plan or an active free-month trial.
  const hasAccess = user ? await hasActiveSubscription(supabase, user.id).catch(() => false) : false;
  const subscribed = Boolean(purchase) || hasAccess;
  const trialOffer = user ? await isTrialOfferEligible(user.id).catch(() => false) : false;
  // Rupees for India (and when the country is unknown); dollars elsewhere. Vercel sets this header on each request.
  const country = (await headers()).get("x-vercel-ip-country");
  const currency: "INR" | "USD" = country && country !== "IN" ? "USD" : "INR";

  let parentName = "";
  let profileKids: Array<{ id: string; name: string; birthYear: number; avatar: string; gender: string | null }> = [];
  if (user) {
    if (!onboarding?.completed) redirect("/onboarding");
    parentName = onboarding.parentName;
    profileKids = onboarding.kids.map(({ id, name, birthYear, avatar, gender }) => ({ id, name, birthYear, avatar, gender }));
  }

  return (
    <AppShell
      initialTemplates={initialTemplates}
      initialCategories={initialCategories}
      canAddTemplates={canUserAddTemplates(user)}
      isAdmin={isTemplateAdmin(user)}
      trialOffer={trialOffer}
      currency={currency}
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
