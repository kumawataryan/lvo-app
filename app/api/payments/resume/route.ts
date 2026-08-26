import { createRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getActivePurchase, setCancelAtPeriodEnd } from "@/lib/payments/repository";

export async function POST() {
  if (!isRazorpayConfigured()) return Response.json({ error: "Payments are not configured yet." }, { status: 503 });

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const purchase = await getActivePurchase(supabase, user.id);
  // Only Razorpay supports undoing a scheduled cancellation — PayPal cancels immediately and
  // can't be un-cancelled, so a "resumed" subscription there would need a fresh checkout.
  if (!purchase || purchase.gateway !== "razorpay" || !purchase.razorpay_subscription_id || !purchase.cancel_at_period_end) {
    return Response.json({ error: "No scheduled cancellation to undo." }, { status: 404 });
  }

  try {
    await createRazorpayClient().subscriptions.cancelScheduledChanges(purchase.razorpay_subscription_id);
    await setCancelAtPeriodEnd(purchase.id, false);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to resume Razorpay subscription", error);
    return Response.json({ error: "Unable to resume subscription. Please try again." }, { status: 500 });
  }
}
