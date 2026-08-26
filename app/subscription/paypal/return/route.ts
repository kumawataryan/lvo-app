import { paypalFetch } from "@/lib/paypal/client";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { findPurchaseByPaypalId, markPurchaseStatus } from "@/lib/payments/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get("subscription_id");
  const orderId = url.searchParams.get("token");

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.redirect(new URL("/login", request.url));

  try {
    if (subscriptionId) {
      const purchase = await findPurchaseByPaypalId("paypal_subscription_id", subscriptionId);
      if (purchase && purchase.user_id === user.id) {
        const subscription = await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}`);
        if (subscription.status === "ACTIVE") {
          await markPurchaseStatus(purchase.id, {
            status: "active",
            currentPeriodEnd: subscription.billing_info?.next_billing_time ?? null,
          });
        }
      }
    } else if (orderId) {
      const purchase = await findPurchaseByPaypalId("paypal_order_id", orderId);
      if (purchase && purchase.user_id === user.id) {
        const capture = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, { method: "POST" });
        if (capture.status === "COMPLETED") {
          await markPurchaseStatus(purchase.id, { status: "completed" });
        }
      }
    }
  } catch (error) {
    console.error("Failed to finalize PayPal checkout", error);
    return Response.redirect(new URL("/subscription?paypal=error", request.url));
  }

  return Response.redirect(new URL("/", request.url));
}
