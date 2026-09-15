import { createSupabaseAuthServerClient } from "@/lib/supabase/server";

type KidInput = { name?: unknown; birthYear?: unknown; avatar?: unknown; gender?: unknown };

const VALID_GENDERS = ["boy", "girl"];

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  let body: { parentName?: unknown; kids?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parentName = typeof body.parentName === "string" ? body.parentName.trim() : "";
  const rawKids = Array.isArray(body.kids) ? (body.kids as KidInput[]) : [];
  if (parentName.length > 60 || rawKids.length > 5) return Response.json({ error: "Please check your details." }, { status: 400 });

  const currentYear = new Date().getFullYear();
  const kids = rawKids.map((kid, index) => ({
    id: typeof (kid as KidInput & { id?: unknown }).id === "string" ? (kid as KidInput & { id: string }).id : undefined,
    name: typeof kid.name === "string" ? kid.name.trim() : "",
    birthYear: Number(kid.birthYear),
    avatar: typeof kid.avatar === "string" ? kid.avatar : "",
    gender: typeof kid.gender === "string" && VALID_GENDERS.includes(kid.gender) ? kid.gender : null,
    sortOrder: index + 1,
  }));
  if (kids.some((kid) => !kid.name || kid.name.length > 40 || !Number.isInteger(kid.birthYear) || kid.birthYear < 1920 || kid.birthYear > currentYear)) {
    return Response.json({ error: "Each kid needs a name and valid birth year." }, { status: 400 });
  }

  const { error } = await supabase.rpc("complete_family_onboarding", {
    parent_name_input: parentName || null,
    kids_input: kids,
  });
  if (error) {
    console.error("Unable to complete onboarding", error);
    return Response.json({ error: "We couldn’t save your family. Please try again." }, { status: 500 });
  }

  const { data: savedKids, error: reloadError } = await supabase
    .from("kids")
    .select("id, name, birth_year, avatar, gender")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (reloadError) {
    console.error("Unable to reload saved children", reloadError);
    return Response.json({ error: "Your details were saved, but couldn’t be reloaded." }, { status: 500 });
  }

  return Response.json({
    ok: true,
    kids: (savedKids ?? []).map((kid) => ({
      id: kid.id,
      name: kid.name,
      birthYear: String(kid.birth_year),
      avatar: kid.avatar,
      gender: kid.gender,
    })),
  });
}
