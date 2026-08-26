import { isPaypalConfigured, paypalFetch } from "@/lib/paypal/client";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { createPendingPurchase } from "@/lib/payments/repository";
import { PAYPAL_PLAN_DETAILS, isPlanId } from "@/lib/payments/plans";

const PAYPAL_PLAN_ENV: Record<"monthly" | "yearly", string | undefined> = {
  monthly: process.env.PAYPAL_PLAN_ID_MONTHLY,
  yearly: process.env.PAYPAL_PLAN_ID_YEARLY,
};

export async function POST(request: Request) {
  if (!isPaypalConfigured()) {
    return Response.json({ error: "Payments are not configured yet." }, { status: 503 });
  }

  let body: { planId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const planId = body.planId;
  if (!isPlanId(planId) || planId === "lifetime") {
    return Response.json({ error: "Invalid plan." }, { status: 400 });
  }

  const paypalPlanId = PAYPAL_PLAN_ENV[planId];
  if (!paypalPlanId) {
    return Response.json({ error: "This plan is not set up yet. Run the PayPal plan setup script first." }, { status: 503 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const plan = PAYPAL_PLAN_DETAILS[planId];
  const origin = new URL(request.url).origin;

  try {
    const purchaseId = await createPendingPurchase(supabase, {
      userId: user.id,
      planId,
      billingType: "subscription",
      gateway: "paypal",
      amount: Math.round(Number(plan.amount) * 100),
      currency: "USD",
    });

    const subscription = await paypalFetch("/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: paypalPlanId,
        custom_id: purchaseId,
        application_context: {
          return_url: `${origin}/subscription/paypal/return`,
          cancel_url: `${origin}/subscription?paypal=cancelled`,
          user_action: "SUBSCRIBE_NOW",
          brand_name: "Craft Library",
        },
      }),
    });

    await supabase.from("purchases").update({ paypal_subscription_id: subscription.id }).eq("id", purchaseId);

    const approveUrl = subscription.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href;
    if (!approveUrl) throw new Error("PayPal did not return an approval link.");

    return Response.json({ approveUrl });
  } catch (error) {
    console.error("Failed to create PayPal subscription", error);
    return Response.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
