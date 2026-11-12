import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { addBrevoContact, escapeHtml, sendBrevoEmail } from "@/lib/email/brevo";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PACK_SIZE = 5;

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lovely.diy").replace(/\/$/, "");
}

export function normalizeLeadEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

// Signed token so the unsubscribe link can't be forged for someone else's address.
function unsubscribeToken(email: string) {
  const secret = process.env.LEAD_UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? "";
  return createHmac("sha256", secret).update(email).digest("hex");
}

export function unsubscribeUrl(email: string) {
  return `${siteUrl()}/api/leads/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken(email)}`;
}

export function isValidUnsubscribe(email: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Saves the address (re-subscribing it if it had opted out), then sends the free pack and adds the contact to Brevo.
export async function captureLead(email: string, source: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: existing } = await supabase.from("email_leads").select("email").eq("email", email).maybeSingle();
  const { error } = await supabase
    .from("email_leads")
    .upsert({ email, source, unsubscribed_at: null }, { onConflict: "email" });
  if (error) throw new Error(`Unable to save email: ${error.message}`);

  // Only new addresses get the free pack, so repeat visitors aren't emailed again.
  const packSent = existing ? false : await sendFreePack(email);
  await addBrevoContact(email, source);
  return { packSent };
}

async function sendFreePack(email: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("title, slug")
    .eq("status", "published")
    .eq("is_free", true)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })
    .limit(PACK_SIZE);

  const site = siteUrl();
  const items = (templates ?? []).map((template) => ({ title: template.title, href: `${site}/t/${template.slug}` }));
  const unsubscribe = unsubscribeUrl(email);
  const intro = "Here are some of our free printable activities to get you started. Print them at home, no card needed.";

  const listHtml = items.length
    ? `<ul>${items.map((item) => `<li><a href="${item.href}">${escapeHtml(item.title)}</a></li>`).join("")}</ul>`
    : `<p><a href="${site}/browse">Browse our free templates</a></p>`;
  const listText = items.length ? items.map((item) => `- ${item.title}: ${item.href}`).join("\n") : `Browse free templates: ${site}/browse`;

  const subject = "Your free printable pack";
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:520px;margin:0 auto;padding:24px">
      <p>Hi there,</p>
      <p>${escapeHtml(intro)}</p>
      ${listHtml}
      <p style="margin:28px 0"><a href="${site}/browse" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">See all free templates</a></p>
      <p style="color:#777;font-size:12px">Lovely Vibes Only · <a href="${unsubscribe}" style="color:#777">Unsubscribe</a></p>
    </div>`;
  const text = `Hi there,\n\n${intro}\n\n${listText}\n\nSee all free templates: ${site}/browse\n\nUnsubscribe: ${unsubscribe}`;

  return sendBrevoEmail({ to: email, subject, html, text });
}

export async function unsubscribeLead(email: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("email_leads")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("email", email);
  if (error) throw new Error(`Unable to unsubscribe: ${error.message}`);
}
