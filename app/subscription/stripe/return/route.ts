import { findPurchaseById, markPurchaseStatus } from "@/lib/payments/repository";
import { createStripeClient } from "@/lib/stripe/client";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return Response.redirect(new URL("/subscription?stripe=error", request.url));

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.redirect(new URL("/login", request.url));

  try {
    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const purchaseId = session.metadata?.purchaseId ?? session.client_reference_id;
    const purchase = purchaseId ? await findPurchaseById(purchaseId) : null;
    if (!purchase || purchase.user_id !== user.id || session.status !== "complete") throw new Error("Invalid Stripe Checkout session.");

    if (purchase.billing_type === "subscription" && session.subscription && typeof session.subscription !== "string") {
      const periodEnd = session.subscription.items.data[0]?.current_period_end;
      await createSupabaseServiceRoleClient().from("purchases").update({
        external_reference: session.subscription.id,
      }).eq("id", purchase.id);
      await markPurchaseStatus(purchase.id, {
        status: "active",
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      });
    } else if (session.payment_status === "paid") {
      await markPurchaseStatus(purchase.id, { status: "completed" });
    }
  } catch (error) {
    console.error("Failed to finalize Stripe Checkout", error);
    return Response.redirect(new URL("/subscription?stripe=error", request.url));
  }

  return Response.redirect(new URL("/", request.url));
}
