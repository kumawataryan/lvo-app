import { NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/server";
import { listPublishedTemplates } from "@/lib/templates/repository";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Templates backend is not configured." }, { status: 503 });
  }

  const category = request.nextUrl.searchParams.get("category")?.trim() || undefined;
  const search = request.nextUrl.searchParams.get("search")?.trim() || undefined;
  const featuredParam = request.nextUrl.searchParams.get("featured");
  const limitParam = request.nextUrl.searchParams.get("limit");

  if (category && !slugPattern.test(category)) {
    return Response.json({ error: "Invalid category." }, { status: 400 });
  }
  if (search && search.length > 80) {
    return Response.json({ error: "Search must be 80 characters or fewer." }, { status: 400 });
  }
  if (featuredParam && featuredParam !== "true" && featuredParam !== "false") {
    return Response.json({ error: "Featured must be true or false." }, { status: 400 });
  }

  const parsedLimit = limitParam ? Number(limitParam) : undefined;
  if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100)) {
    return Response.json({ error: "Limit must be an integer between 1 and 100." }, { status: 400 });
  }

  try {
    const templates = await listPublishedTemplates({
      category,
      search,
      featured: featuredParam ? featuredParam === "true" : undefined,
      limit: parsedLimit,
    });
    return Response.json({ data: templates }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Failed to list templates", error);
    return Response.json({ error: "Unable to load templates." }, { status: 500 });
  }
}
