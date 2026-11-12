import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendTrialEmail } from "@/lib/email/trial-emails";

export const TRIAL_DOWNLOAD_THRESHOLD = 50;
export const TRIAL_LENGTH_DAYS = 30;

// Records a free download so we can tell who has been using the free library. Failures are logged, not thrown.
export async function recordFreeDownload(userId: string, templateId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("template_downloads")
    .upsert({ user_id: userId, template_id: templateId }, { onConflict: "user_id,template_id", ignoreDuplicates: true });
  if (error) console.error("Unable to record free download", error);
}

// A user qualifies once they've downloaded enough free templates and have never paid or claimed a trial.
export async function isTrialOfferEligible(userId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const [{ count: downloads }, { data: purchase }, { data: trial }] = await Promise.all([
    supabase.from("template_downloads").select("template_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("purchases").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("free_trials").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  return (downloads ?? 0) >= TRIAL_DOWNLOAD_THRESHOLD && !purchase && !trial;
}

// Starts a 30-day trial. Re-checks eligibility on the server so the client can't claim it directly.
export async function claimTrial(userId: string) {
  if (!(await isTrialOfferEligible(userId))) return { ok: false as const, error: "This offer isn't available for your account." };

  const supabase = createSupabaseServiceRoleClient();
  const endsAt = new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("free_trials").insert({ user_id: userId, ends_at: endsAt });
  if (error) {
    if (error.code === "23505") return { ok: false as const, error: "You've already started your free month." };
    console.error("Unable to start trial", error);
    return { ok: false as const, error: "Could not start your free month. Please try again." };
  }
  // Welcome email. Failures are logged inside sendTrialEmail and never block the trial.
  await sendTrialEmail(userId, endsAt, "trial_started").catch((emailError) => console.error("Trial welcome email failed", emailError));
  return { ok: true as const, endsAt };
}
