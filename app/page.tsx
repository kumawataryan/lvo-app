import CraftApp from "@/components/craft-app";
import { canUserAddTemplates } from "@/lib/auth/permissions";
import { createSupabaseAuthServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listPublishedTemplates } from "@/lib/templates/repository";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;

  if (!isSupabaseConfigured()) return <CraftApp initialTab={tab} />;

  const [initialTemplates, user] = await Promise.all([
    listPublishedTemplates().catch((error) => {
        console.error("Failed to preload templates", error);
        return [];
      }),
    createSupabaseAuthServerClient()
      .then((supabase) => supabase.auth.getUser())
      .then(({ data }) => data.user)
      .catch(() => null),
  ]);

  return <CraftApp initialTemplates={initialTemplates} canAddTemplates={canUserAddTemplates(user)} initialTab={tab} />;
}
