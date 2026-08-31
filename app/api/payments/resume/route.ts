import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getActivePurchase } from "@/lib/payments/repository";

export async function POST() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const purchase = await getActivePurchase(supabase, user.id);
  if (!purchase || !purchase.cancel_at_period_end) {
    return Response.json({ error: "No scheduled cancellation to undo." }, { status: 404 });
  }
  return Response.json({ error: "Cancelled subscriptions can’t be reactivated. Choose a new plan after your current access ends." }, { status: 409 });
}
