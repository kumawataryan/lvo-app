import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { escapeHtml, sendBrevoEmail } from "@/lib/email/brevo";

export type LifecycleEmailKey = "payment_failed" | "ending_7d" | "ending_1d" | "winback_30d" | "winback_60d";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 200;

type PurchaseRow = {
  id: string;
  user_id: string;
  status: string;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  updated_at: string;
};

export type PlannedEmail = { purchaseId: string; userId: string; key: LifecycleEmailKey };

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lovely.diy").replace(/\/$/, "");
}

function formatDate(value: string | null) {
  if (!value) return "soon";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function joinNames(names: string[]) {
  if (!names.length) return "your little ones";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Decides which single lifecycle email, if any, a purchase is due for right now.
export function plannedEmailFor(purchase: PurchaseRow, now: Date): LifecycleEmailKey | null {
  if (purchase.status === "halted") return "payment_failed";

  // Cancelled at period end: remind before access ends, then start win-back once it has ended.
  const endsAt = purchase.current_period_end ? new Date(purchase.current_period_end).getTime() : null;
  if (purchase.status === "active" && purchase.cancel_at_period_end && endsAt) {
    const daysLeft = (endsAt - now.getTime()) / DAY_MS;
    if (daysLeft > 0 && daysLeft <= 1) return "ending_1d";
    if (daysLeft > 1 && daysLeft <= 7) return "ending_7d";
    if (daysLeft <= 0) return winBackKey((now.getTime() - endsAt) / DAY_MS);
    return null;
  }

  // Cancelled outright: win-back counts from the cancellation.
  if (purchase.status === "cancelled") {
    return winBackKey((now.getTime() - new Date(purchase.updated_at).getTime()) / DAY_MS);
  }

  return null;
}

function winBackKey(daysSince: number): LifecycleEmailKey | null {
  if (daysSince >= 60) return "winback_60d";
  if (daysSince >= 30) return "winback_30d";
  return null;
}

function buildEmail(key: LifecycleEmailKey, ctx: { greeting: string; kidNames: string; endDate: string }) {
  const site = siteUrl();
  const { greeting, kidNames, endDate } = ctx;

  const keepList = [
    `New templates every month for ${kidNames}`,
    "Print-ready downloads you can use anytime",
    "Your saved collections and favorites",
  ];

  const copy: Record<LifecycleEmailKey, { subject: string; intro: string; list: string[]; cta: string; href: string }> = {
    ending_7d: {
      subject: "Your Lovely Vibes Only access ends in 7 days",
      intro: `Your subscription ends on ${endDate}. Here's what you'd lose:`,
      list: keepList,
      cta: "Stay with us",
      href: `${site}/subscription`,
    },
    ending_1d: {
      subject: "Your access ends tomorrow",
      intro: `Your subscription ends on ${endDate}. Keep everything you've been using:`,
      list: keepList,
      cta: "Keep my access",
      href: `${site}/subscription`,
    },
    payment_failed: {
      subject: "We couldn't renew your subscription",
      intro: "Your last payment didn't go through, so your access is paused. Update your payment details to pick up where you left off.",
      list: [],
      cta: "Update payment details",
      href: `${site}/subscription`,
    },
    winback_30d: {
      subject: `New templates for ${kidNames} this month`,
      intro: `We've added new templates since you left. Come back and find something for ${kidNames}.`,
      list: [],
      cta: "See what's new",
      href: `${site}/browse`,
    },
    winback_60d: {
      subject: `${kidNames} misses Lovely Vibes Only`,
      intro: "It's been a while. We'd love to have you back, with a fresh set of activities for the kids.",
      list: [],
      cta: "Come back",
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

// Finds due emails across all purchases, minus the ones already sent.
export async function planSubscriptionEmails(now = new Date()) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: purchases, error } = await supabase
    .from("purchases")
    .select("id, user_id, status, cancel_at_period_end, current_period_end, updated_at")
    .in("status", ["active", "halted", "cancelled"])
    .limit(5000);
  if (error) throw new Error(`Unable to load purchases: ${error.message}`);

  const due = (purchases ?? []).flatMap((purchase) => {
    const key = plannedEmailFor(purchase as PurchaseRow, now);
    return key ? [{ purchaseId: purchase.id, userId: purchase.user_id, key }] : [];
  });
  if (!due.length) return [];

  const { data: sent, error: sentError } = await supabase
    .from("subscription_email_log")
    .select("purchase_id, email_key")
    .in("purchase_id", due.map((item) => item.purchaseId));
  if (sentError) throw new Error(`Unable to load email log: ${sentError.message}`);

  const alreadySent = new Set((sent ?? []).map((row) => `${row.purchase_id}:${row.email_key}`));
  return due.filter((item) => !alreadySent.has(`${item.purchaseId}:${item.key}`));
}

// Sends the planned emails (or only reports them when dryRun is set), recording each successful send.
export async function sendSubscriptionEmails({ dryRun = false, now = new Date() } = {}) {
  const planned = (await planSubscriptionEmails(now)).slice(0, BATCH_LIMIT);
  if (dryRun) return { dryRun: true, planned: planned.map(({ purchaseId, key }) => ({ purchaseId, key })), sent: 0, failed: 0 };

  const supabase = createSupabaseServiceRoleClient();
  let sent = 0;
  let failed = 0;

  for (const item of planned) {
    const { data: userData } = await supabase.auth.admin.getUserById(item.userId);
    const email = userData.user?.email;
    if (!email) {
      failed += 1;
      continue;
    }

    const [{ data: profile }, { data: kids }, { data: purchase }] = await Promise.all([
      supabase.from("user_profiles").select("parent_name").eq("user_id", item.userId).maybeSingle(),
      supabase.from("kids").select("name").eq("user_id", item.userId).order("sort_order"),
      supabase.from("purchases").select("current_period_end").eq("id", item.purchaseId).maybeSingle(),
    ]);

    const greeting = profile?.parent_name ? `Hi ${profile.parent_name}` : "Hi there";
    const kidNames = joinNames((kids ?? []).map((kid) => kid.name));
    const endDate = formatDate(purchase?.current_period_end ?? null);
    const { subject, html, text } = buildEmail(item.key, { greeting, kidNames, endDate });

    const ok = await sendBrevoEmail({ to: email, subject, html, text });
    if (!ok) {
      failed += 1;
      continue;
    }

    const { error: logError } = await supabase
      .from("subscription_email_log")
      .insert({ purchase_id: item.purchaseId, email_key: item.key });
    if (logError) console.error("Unable to record subscription email", logError);
    sent += 1;
  }

  return { dryRun: false, planned: planned.length, sent, failed };
}
