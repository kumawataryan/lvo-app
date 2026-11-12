import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_N = 10;

// Counts one successful download: a timestamped event for rankings, plus the running total. Failures are logged, never thrown.
export async function countTemplateDownload(templateId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const [{ error: eventError }, { error: totalError }] = await Promise.all([
    supabase.from("template_download_events").insert({ template_id: templateId }),
    supabase.rpc("increment_template_download", { p_template_id: templateId }),
  ]);
  if (eventError) console.error("Unable to record download event", eventError);
  if (totalError) console.error("Unable to count template download", totalError);
}

async function topTemplateIds(sinceDays: number) {
  const supabase = createSupabaseServiceRoleClient();
  const since = new Date(Date.now() - sinceDays * DAY_MS).toISOString();
  const { data, error } = await supabase.rpc("get_top_downloaded_templates", { p_since: since, p_limit: TOP_N });
  if (error) {
    console.error("Unable to load download rankings", error);
    return [];
  }
  return (data ?? []).map((row: { template_id: string }) => row.template_id);
}

// The badge for one template, based only on real downloads. Returns null when it doesn't rank in the top 10 or has no downloads.
export async function getTemplateBadge(templateId: string): Promise<string | null> {
  const [weekly, monthly] = await Promise.all([topTemplateIds(7), topTemplateIds(30)]);
  if (weekly.includes(templateId)) return "Top 10 this week";
  if (monthly.includes(templateId)) return "Popular this month";
  return null;
}

// Badges for every template at once, so lists can show them. Weekly ranking wins over monthly.
export async function getTemplateBadgeMap(): Promise<Map<string, string>> {
  const [weekly, monthly] = await Promise.all([topTemplateIds(7), topTemplateIds(30)]);
  const badges = new Map<string, string>();
  for (const id of monthly) badges.set(id, "Popular this month");
  for (const id of weekly) badges.set(id, "Top 10 this week");
  return badges;
}
