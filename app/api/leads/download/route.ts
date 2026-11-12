import { captureLead, normalizeLeadEmail } from "@/lib/leads/server";
import { getDropboxTemporaryLink } from "@/lib/dropbox/server";
import { countTemplateDownload } from "@/lib/templates/downloads";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60;

// Email gate for free printables: saves the email, then returns a short-lived file link for the browser to download.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; slug?: unknown; website?: unknown } | null;

  // Bots fill the hidden field.
  if (typeof body?.website === "string" && body.website.trim()) return Response.json({ error: "Please try again." }, { status: 400 });

  const email = typeof body?.email === "string" ? normalizeLeadEmail(body.email) : null;
  if (!email) return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  const slug = typeof body?.slug === "string" ? body.slug : "";

  const supabase = createSupabaseServiceRoleClient();
  const { data: template } = await supabase
    .from("templates")
    .select("id, slug, printable_path")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_free", true)
    .maybeSingle();
  if (!template?.printable_path) return Response.json({ error: "This printable isn't available." }, { status: 404 });

  try {
    await captureLead(email, "template");
  } catch (error) {
    console.error("Email gate capture failed", error);
    return Response.json({ error: "We couldn't save your email. Please try again." }, { status: 500 });
  }

  const extension = template.printable_path.split(".").pop()?.toLowerCase() || "pdf";
  const filename = `${template.slug}-template.${extension}`;

  try {
    let url: string;
    if (template.printable_path.startsWith("/lvo-files/")) {
      ({ link: url } = await getDropboxTemporaryLink(template.printable_path));
    } else {
      const { data: signed, error: signError } = await supabase.storage
        .from("template-printables")
        .createSignedUrl(template.printable_path, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed) throw signError ?? new Error("No signed URL");
      url = signed.signedUrl;
    }
    await countTemplateDownload(template.id);
    return Response.json({ url, filename });
  } catch (error) {
    console.error("Unable to create printable link", error);
    return Response.json({ error: "Unable to prepare the printable. Please try again." }, { status: 500 });
  }
}
