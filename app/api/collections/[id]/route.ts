import { createSupabaseAuthServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) return Response.json({ error: "Enter a collection name." }, { status: 400 });

  const { data, error } = await supabase.from("template_collections")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name")
    .maybeSingle();

  if (error?.code === "23505") return Response.json({ error: "A collection with this name already exists." }, { status: 409 });
  if (error) return Response.json({ error: "Couldn’t rename this collection." }, { status: 500 });
  if (!data) return Response.json({ error: "Collection not found." }, { status: 404 });
  return Response.json({ collection: data });
}
