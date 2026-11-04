import { redirect } from "next/navigation";

import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getCachedTemplates } from "@/lib/templates/cached";
import { LikedScreen } from "./liked-screen";
import { hasActiveSubscription } from "@/lib/payments/repository";

export const dynamic = "force-dynamic";

export default async function LikedPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [onboarding, { data: likes }, publishedTemplates, subscribed] = await Promise.all([
    getFamilyOnboarding(supabase, user.id).catch(() => null),
    supabase.from("template_likes").select("template_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    getCachedTemplates(),
    hasActiveSubscription(supabase, user.id).catch(() => false),
  ]);
  if (!onboarding?.completed) redirect("/onboarding");
  const templatesById = new Map(publishedTemplates.map((template) => [template.id, template]));
  const likedTemplates = (likes ?? []).flatMap((like: { template_id: string }) => {
    const template = templatesById.get(like.template_id);
    return template ? [template] : [];
  });

  return <LikedScreen templates={likedTemplates} subscribed={subscribed} />;
}
