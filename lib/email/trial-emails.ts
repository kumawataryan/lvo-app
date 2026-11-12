import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { escapeHtml, sendBrevoEmail } from "@/lib/email/brevo";

export type TrialEmailKey = "trial_started" | "trial_ending_7d" | "trial_ending_1d" | "trial_ended";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 200;
// Only mention a trial that ended recently; older ones are not worth a late email.
const ENDED_WINDOW_DAYS = 7;

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lovely.diy").replace(/\/$/, "");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function joinNames(names: string[]) {
  if (!names.length) return "your little ones";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function buildTrialEmail(key: TrialEmailKey, ctx: { greeting: string; kidNames: string; endDate: string }) {
  const site = siteUrl();
  const { greeting, kidNames, endDate } = ctx;

  const copy: Record<TrialEmailKey, { subject: string; intro: string; list: string[]; cta: string; href: string }> = {
    trial_started: {
      subject: "Your free month has started",
      intro: `Welcome! You have full access until ${endDate}. Here's a good place to start:`,
      list: [
        `Printable activities picked for ${kidNames}`,
        "Unlimited downloads, print-ready files",
        "New templates added every month",
      ],
      cta: "Browse templates",
      href: `${site}/browse`,
    },
    trial_ending_7d: {
      subject: "Your free month ends in 7 days",
      intro: `Your free month ends on ${endDate}. Subscribe to keep downloading and printing for ${kidNames}.`,
      list: [],
      cta: "See plans",
      href: `${site}/subscription`,
    },
    trial_ending_1d: {
      subject: "Your free month ends tomorrow",
      intro: `Your access ends on ${endDate}. Subscribe now to keep everything you've been using.`,
      list: [],
      cta: "Keep my access",
      href: `${site}/subscription`,
    },
    trial_ended: {
      subject: `Pick up where you left off, ${kidNames}`,
      intro: "Your free month has ended. Subscribe to get new templates every month and keep downloading.",
      list: [],
      cta: "See plans",
      href: `${site}/subscription`,
    },
  };

  const { subject, intro, list, cta, href } = copy[key];
  const listHtml = list.length ? `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
  const listText = list.length ? `\n${list.map((item) => `- ${item}`).join("\n")}\n` : "";

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:520px;margin:0 auto;padding:24px">
      <p>${escapeHtml(greeting)},</p>
      <p>${escapeHtml(intro)}</p>
      ${listHtml}
      <p style="margin:28px 0"><a href="${href}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${escapeHtml(cta)}</a></p>
      <p style="color:#777;font-size:12px">Lovely Vibes Only</p>
    </div>`;
  const text = `${greeting},\n\n${intro}\n${listText}\n${cta}: ${href}\n\nLovely Vibes Only`;

  return { subject, html, text };
}

async function loadRecipient(userId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const email = userData.user?.email;
  if (!email) return null;

  const [{ data: profile }, { data: kids }] = await Promise.all([
    supabase.from("user_profiles").select("parent_name").eq("user_id", userId).maybeSingle(),
    supabase.from("kids").select("name").eq("user_id", userId).order("sort_order"),
  ]);
  return {
    email,
    greeting: profile?.parent_name ? `Hi ${profile.parent_name}` : "Hi there",
    kidNames: joinNames((kids ?? []).map((kid) => kid.name)),
  };
}

// Sends one trial email and records it. Skips if it was already sent. Returns true if sent.
export async function sendTrialEmail(userId: string, endsAt: string, key: TrialEmailKey) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: already } = await supabase
    .from("trial_email_log")
    .select("email_key")
    .eq("user_id", userId)
    .eq("email_key", key)
    .maybeSingle();
  if (already) return false;

  const recipient = await loadRecipient(userId);
  if (!recipient) return false;

  const { subject, html, text } = buildTrialEmail(key, {
    greeting: recipient.greeting,
    kidNames: recipient.kidNames,
    endDate: formatDate(endsAt),
  });
  const ok = await sendBrevoEmail({ to: recipient.email, subject, html, text });
  if (!ok) return false;

  const { error } = await supabase.from("trial_email_log").insert({ user_id: userId, email_key: key });
  if (error) console.error("Unable to record trial email", error);
  return true;
}

// Finds which trial emails are due now across all trials, minus ones already sent and users who have subscribed.
export async function sendDueTrialEmails({ dryRun = false, now = new Date() } = {}) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: trials, error } = await supabase
    .from("free_trials")
    .select("user_id, ends_at")
    .gte("ends_at", new Date(now.getTime() - ENDED_WINDOW_DAYS * DAY_MS).toISOString())
    .limit(5000);
  if (error) throw new Error(`Unable to load trials: ${error.message}`);
  if (!trials?.length) return { sent: 0 };
  if (dryRun) return { sent: 0, dryRun: true };

  const userIds = trials.map((trial) => trial.user_id);
  const { data: purchases } = await supabase
    .from("purchases")
    .select("user_id")
    .in("user_id", userIds)
    .in("status", ["active", "completed"]);
  const subscribed = new Set((purchases ?? []).map((row) => row.user_id));

  let sent = 0;
  for (const trial of trials.slice(0, BATCH_LIMIT)) {
    if (subscribed.has(trial.user_id)) continue;
    const endsAt = new Date(trial.ends_at).getTime();
    const daysLeft = (endsAt - now.getTime()) / DAY_MS;
    const key: TrialEmailKey | null =
      daysLeft > 1 && daysLeft <= 7 ? "trial_ending_7d"
      : daysLeft > 0 && daysLeft <= 1 ? "trial_ending_1d"
      : daysLeft <= 0 ? "trial_ended"
      : null;
    if (!key) continue;
    if (await sendTrialEmail(trial.user_id, trial.ends_at, key)) sent += 1;
  }
  return { sent };
}
