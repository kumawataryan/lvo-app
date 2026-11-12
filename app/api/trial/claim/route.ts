import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { claimTrial } from "@/lib/trials/server";

export async function POST() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to start your free month." }, { status: 401 });

  const result = await claimTrial(user.id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true, endsAt: result.endsAt });
}
