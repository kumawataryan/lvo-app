import { createRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { isPaypalConfigured, paypalFetch } from "@/lib/paypal/client";
import { createStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getActivePurchase, markPurchaseStatus, setCancelAtPeriodEnd } from "@/lib/payments/repository";

export async function POST() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const purchase = await getActivePurchase(supabase, user.id);
  if (!purchase || purchase.billing_type !== "subscription") {
    return Response.json({ error: "No active subscription to cancel." }, { status: 404 });
  }

  try {
    if (purchase.gateway === "razorpay") {
      if (!isRazorpayConfigured() || !purchase.razorpay_subscription_id) {
        return Response.json({ error: "No active subscription to cancel." }, { status: 404 });
      }
      // cancelAtCycleEnd = true: Razorpay keeps access until the period already paid for ends,
      // then stops future charges. Our own status stays "active" until the webhook confirms the cycle ended.
      await createRazorpayClient().subscriptions.cancel(purchase.razorpay_subscription_id, true);
      await setCancelAtPeriodEnd(purchase.id, true);
    } else if (purchase.gateway === "paypal") {
      if (!isPaypalConfigured() || !purchase.paypal_subscription_id) {
        return Response.json({ error: "No active subscription to cancel." }, { status: 404 });
      }
      // PayPal has no "cancel at period end" option — cancellation is immediate on their side,
      // so we reflect that immediately here too rather than promising access we can't guarantee.
      await paypalFetch(`/v1/billing/subscriptions/${purchase.paypal_subscription_id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Cancelled by customer" }),
      });
      await markPurchaseStatus(purchase.id, { status: "cancelled" });
    } else if (purchase.gateway === "stripe") {
      if (!isStripeConfigured() || !purchase.external_reference) {
        return Response.json({ error: "No active subscription to cancel." }, { status: 404 });
      }
      await createStripeClient().subscriptions.update(purchase.external_reference, { cancel_at_period_end: true });
      await setCancelAtPeriodEnd(purchase.id, true);
    } else {
      return Response.json({ error: "This subscription was activated manually — contact support to cancel it." }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to cancel subscription", error);
    return Response.json({ error: "Unable to cancel subscription. Please try again." }, { status: 500 });
  }
}
