import { createRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { createPendingPurchase } from "@/lib/payments/repository";
import { RAZORPAY_PLAN_DETAILS, isPlanId } from "@/lib/payments/plans";

const RAZORPAY_PLAN_ENV: Record<"monthly" | "yearly", string | undefined> = {
  monthly: process.env.RAZORPAY_PLAN_ID_MONTHLY,
  yearly: process.env.RAZORPAY_PLAN_ID_YEARLY,
};

// Total billing cycles Razorpay will run before the subscription needs re-authorization.
// Set high enough to behave as "until cancelled" in practice.
const TOTAL_COUNT: Record<"monthly" | "yearly", number> = {
  monthly: 120, // 10 years of monthly cycles
  yearly: 20, // 20 years of yearly cycles
};

export async function POST(request: Request) {
  if (!isRazorpayConfigured()) {
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

  const razorpayPlanId = RAZORPAY_PLAN_ENV[planId];
  if (!razorpayPlanId) {
    return Response.json({ error: "This plan is not set up yet. Run the Razorpay plan setup script first." }, { status: 503 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const plan = RAZORPAY_PLAN_DETAILS[planId];

  try {
    const razorpay = createRazorpayClient();
    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: TOTAL_COUNT[planId],
      notes: { user_id: user.id, plan_id: planId },
    });

    await createPendingPurchase(supabase, {
      userId: user.id,
      planId,
      billingType: "subscription",
      gateway: "razorpay",
      amount: plan.amount,
      currency: "INR",
      razorpaySubscriptionId: subscription.id,
    });

    return Response.json({
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Failed to create Razorpay subscription", error);
    return Response.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
