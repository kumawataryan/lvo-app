import CraftApp from "@/components/craft-app";
import { canUserAddTemplates } from "@/lib/auth/permissions";
import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listPublishedTemplates } from "@/lib/templates/repository";

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

  const subscribed = user ? await hasActiveSubscription(supabase, user.id).catch(() => false) : false;

  return <CraftApp initialTemplates={initialTemplates} canAddTemplates={canUserAddTemplates(user)} subscribed={subscribed} initialTab={tab} />;
}
