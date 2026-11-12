import { captureLead, normalizeLeadEmail } from "@/lib/leads/server";

const SOURCES = new Set(["homepage", "template", "other"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; source?: unknown; website?: unknown } | null;

  // Bots fill the hidden field; pretend it worked.
  if (typeof body?.website === "string" && body.website.trim()) return Response.json({ ok: true });

  const email = typeof body?.email === "string" ? normalizeLeadEmail(body.email) : null;
  if (!email) return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  const source = typeof body?.source === "string" && SOURCES.has(body.source) ? body.source : "homepage";

  try {
    const { packSent } = await captureLead(email, source);
    if (!packSent) console.error("Free pack email failed for a new lead");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Lead capture failed", error);
    return Response.json({ error: "We couldn't save your email. Please try again." }, { status: 500 });
  }
}
