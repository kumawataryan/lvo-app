const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 2000;

type ContactBody = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  website?: unknown; // honeypot: real users leave this empty
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  const apiKey = process.env.BREVO_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL ?? "hi@lovely.diy";
  const fromEmail = process.env.CONTACT_FROM_EMAIL ?? "hi@lovely.diy";
  if (!apiKey) return Response.json({ error: "Contact form is not configured yet." }, { status: 500 });

  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Silently accept bot submissions that fill the hidden field.
  if (typeof body.website === "string" && body.website.trim()) {
    return Response.json({ ok: true });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || name.length > MAX_NAME) return Response.json({ error: "Please enter your name." }, { status: 400 });
  if (!email || email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message || message.length > MAX_MESSAGE) {
    return Response.json({ error: `Please write a message (up to ${MAX_MESSAGE} characters).` }, { status: 400 });
  }

  const htmlContent = `
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "lovely.diy contact form", email: fromEmail },
        to: [{ email: toEmail }],
        replyTo: { email, name },
        subject: `New contact message from ${name}`,
        htmlContent,
        textContent: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      }),
    });

    if (!response.ok) {
      console.error("Brevo contact email failed", response.status, await response.text());
      return Response.json({ error: "We could not send your message. Please try again." }, { status: 502 });
    }
  } catch (error) {
    console.error("Brevo contact email error", error);
    return Response.json({ error: "We could not send your message. Please try again." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
