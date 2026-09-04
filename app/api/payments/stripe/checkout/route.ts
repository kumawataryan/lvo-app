import { amountInCents, isPlanId, PLAN_DETAILS } from "@/lib/payments/plans";
import { createPendingPurchase } from "@/lib/payments/repository";
import { createStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isStripeConfigured()) return Response.json({ error: "Payments are not configured yet." }, { status: 503 });

  let body: { planId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!isPlanId(body.planId)) return Response.json({ error: "Invalid plan." }, { status: 400 });

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const plan = PLAN_DETAILS[body.planId];
  const origin = new URL(request.url).origin;

  try {
    const purchaseId = await createPendingPurchase(supabase, {
      userId: user.id,
      planId: body.planId,
      billingType: plan.billingType,
      gateway: "stripe",
      amount: amountInCents(body.planId),
      currency: "USD",
    });
    const session = await createStripeClient().checkout.sessions.create({
      mode: plan.billingType === "subscription" ? "subscription" : "payment",
      customer_email: user.email,
      client_reference_id: purchaseId,
      metadata: { purchaseId },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountInCents(body.planId),
          product_data: { name: `Craft Library ${plan.name} plan` },
          ...(plan.billingType === "subscription"
            ? { recurring: { interval: body.planId === "monthly" ? "month" : "year" } }
            : {}),
        },
      }],
      success_url: `${origin}/subscription/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscription?stripe=cancelled`,
    });
    await createSupabaseServiceRoleClient().from("purchases").update({ external_reference: session.id }).eq("id", purchaseId);
    return Response.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("Failed to create Stripe Checkout session", error);
    return Response.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
