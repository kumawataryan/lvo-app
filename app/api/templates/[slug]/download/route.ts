import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to download." }, { status: 401 });

  const subscribed = await hasActiveSubscription(supabase, user.id).catch(() => false);
  if (!subscribed) return Response.json({ error: "Subscribe to download printables." }, { status: 403 });

  const { data: template, error } = await supabase
    .from("templates")
    .select("printable_path")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) return Response.json({ error: "Unable to load template." }, { status: 500 });
  if (!template?.printable_path) return Response.json({ error: "Printable not available yet." }, { status: 404 });

  const serviceClient = createSupabaseServiceRoleClient();
  const { data: signed, error: signError } = await serviceClient.storage
    .from("template-printables")
    .createSignedUrl(template.printable_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    console.error("Failed to sign printable URL", signError);
    return Response.json({ error: "Unable to generate download link." }, { status: 500 });
  }

  return Response.json({ url: signed.signedUrl });
}
