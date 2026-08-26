import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getPublishedTemplateBySlug } from "@/lib/templates/repository";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Templates backend is not configured." }, { status: 503 });
  }

  const { slug } = await params;
  if (!slugPattern.test(slug)) {
    return Response.json({ error: "Invalid template slug." }, { status: 400 });
  }

  try {
    const template = await getPublishedTemplateBySlug(slug);
    if (!template) return Response.json({ error: "Template not found." }, { status: 404 });
    return Response.json({ data: template }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Failed to load template", error);
    return Response.json({ error: "Unable to load template." }, { status: 500 });
  }
}
