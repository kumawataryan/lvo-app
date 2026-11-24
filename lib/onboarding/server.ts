import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type FamilyKid = {
  id: string;
  name: string;
  birthYear: number;
  avatar: string;
  gender: string | null;
  sortOrder: number;
};

export type FamilyOnboarding = {
  parentName: string;
  completed: boolean;
  kids: FamilyKid[];
};

export async function getFamilyOnboarding(supabase: SupabaseClient, userId: string): Promise<FamilyOnboarding> {
  const [profileResult, kidsResult] = await Promise.all([
    supabase.from("user_profiles").select("parent_name, onboarding_completed_at").eq("user_id", userId).maybeSingle(),
    supabase.from("kids").select("id, name, birth_year, avatar, gender, sort_order").eq("user_id", userId).order("sort_order"),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (kidsResult.error) throw kidsResult.error;

  return {
    parentName: profileResult.data?.parent_name ?? "",
    completed: Boolean(profileResult.data?.onboarding_completed_at),
    kids: (kidsResult.data ?? []).map((kid) => ({
      id: kid.id,
      name: kid.name,
      birthYear: kid.birth_year,
      avatar: kid.avatar,
      gender: kid.gender ?? null,
      sortOrder: kid.sort_order,
    })),
  };
}

/** Just whether onboarding is done: one small query, for pages that only need to redirect. */
export async function isOnboardingCompleted(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("user_profiles").select("onboarding_completed_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data?.onboarding_completed_at);
}
