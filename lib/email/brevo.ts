import "server-only";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sends a transactional email through Brevo. Returns false (and logs) instead of throwing, so one failed send doesn't stop a batch.
export async function sendBrevoEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY is not set; email not sent.");
    return false;
  }
  const fromEmail = process.env.CONTACT_FROM_EMAIL ?? "hi@lovely.diy";

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Lovely Vibes Only", email: fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!response.ok) {
      console.error("Brevo email failed", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Brevo email error", error);
    return false;
  }
}

// Adds or updates a contact in Brevo, optionally into a list you send campaigns to. Returns false on failure.
export async function addBrevoContact(email: string, source: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  const listId = Number(process.env.BREVO_LEADS_LIST_ID);
  try {
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email,
        updateEnabled: true,
        ...(Number.isInteger(listId) && listId > 0 ? { listIds: [listId] } : {}),
        attributes: { SOURCE: source },
      }),
    });
    if (!response.ok) console.error("Brevo contact add failed", response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error("Brevo contact add error", error);
    return false;
  }
}
