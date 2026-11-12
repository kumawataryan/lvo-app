import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { escapeHtml, sendBrevoEmail } from "@/lib/email/brevo";

// Only brand-new accounts get the welcome email. This stops existing users getting it on their next login.
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lovely.diy").replace(/\/$/, "");
}

export async function sendWelcomeEmailIfNew(user: { id: string; email?: string | null; created_at?: string }) {
  if (!user.email) return false;
  if (!user.created_at || Date.now() - new Date(user.created_at).getTime() > NEW_ACCOUNT_WINDOW_MS) return false;

  const supabase = createSupabaseServiceRoleClient();
  const { data: already } = await supabase
    .from("user_email_log")
    .select("email_key")
    .eq("user_id", user.id)
    .eq("email_key", "welcome")
    .maybeSingle();
  if (already) return false;

  const { data: profile } = await supabase.from("user_profiles").select("parent_name").eq("user_id", user.id).maybeSingle();
  const greeting = profile?.parent_name ? `Hi ${profile.parent_name}` : "Hi there";
  const href = `${siteUrl()}/browse`;
  const intro = "Thanks for joining. Our printable activities are made for little hands. Here's how to get started:";
  const steps = [
    "Download any free template, no card needed",
    "Add your kids to get activities matched to their age",
    "Save favorites into a collection for each child",
  ];

  const subject = "Welcome to Lovely Vibes Only";
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:520px;margin:0 auto;padding:24px">
      <p>${escapeHtml(greeting)},</p>
      <p>${escapeHtml(intro)}</p>
      <ul>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>
      <p style="margin:28px 0"><a href="${href}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Browse free templates</a></p>
      <p style="color:#777;font-size:12px">Lovely Vibes Only</p>
    </div>`;
  const text = `${greeting},\n\n${intro}\n\n${steps.map((step) => `- ${step}`).join("\n")}\n\nBrowse free templates: ${href}\n\nLovely Vibes Only`;

  const ok = await sendBrevoEmail({ to: user.email, subject, html, text });
  if (!ok) return false;

  const { error } = await supabase.from("user_email_log").insert({ user_id: user.id, email_key: "welcome" });
  if (error) console.error("Unable to record welcome email", error);
  return true;
}
