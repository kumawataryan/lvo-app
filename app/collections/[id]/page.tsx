import { notFound, redirect } from "next/navigation";

import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { listPublishedTemplates } from "@/lib/templates/repository";
import { CollectionScreen } from "./collection-screen";
import { hasActiveSubscription } from "@/lib/payments/repository";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const onboarding = await getFamilyOnboarding(supabase, user.id).catch(() => null);
  if (!onboarding?.completed) redirect("/onboarding");

  const [{ data: collection }, { data: kid }, publishedTemplates, subscribed] = await Promise.all([
    supabase.from("template_collections").select("id, name, template_collection_items(template_id)").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("kids").select("avatar").eq("collection_id", id).eq("user_id", user.id).maybeSingle(),
    listPublishedTemplates().catch(() => []),
    hasActiveSubscription(supabase, user.id).catch(() => false),
  ]);

  if (!collection) notFound();
  const templateIds = new Set((collection.template_collection_items ?? []).map((item: { template_id: string }) => item.template_id));

  return (
    <CollectionScreen
      collection={{ id: collection.id, name: collection.name, childAvatar: kid?.avatar ?? null }}
      templates={publishedTemplates.filter((template) => templateIds.has(template.id))}
      subscribed={subscribed}
    />
  );
}
