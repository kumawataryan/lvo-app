import { redirect } from "next/navigation";

import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { OnboardingFlow } from "./onboarding-flow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const family = await getFamilyOnboarding(supabase, user.id).catch(() => ({ parentName: "", completed: false, kids: [] }));
  return <OnboardingFlow initialFamily={family} />;
}
