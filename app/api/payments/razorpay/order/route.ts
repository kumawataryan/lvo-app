import { createRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { createPendingPurchase } from "@/lib/payments/repository";
import { PLAN_DETAILS } from "@/lib/payments/plans";

export async function POST() {
  if (!isRazorpayConfigured()) {
    return Response.json({ error: "Payments are not configured yet." }, { status: 503 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const plan = PLAN_DETAILS.lifetime;

  try {
    const razorpay = createRazorpayClient();
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: "INR",
      receipt: `lifetime_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id, plan_id: plan.id },
    });

    await createPendingPurchase(supabase, {
      userId: user.id,
      planId: plan.id,
      billingType: "one_time",
      gateway: "razorpay",
      amount: plan.amount,
      currency: "INR",
      razorpayOrderId: order.id,
    });

    return Response.json({
      orderId: order.id,
      amount: plan.amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Failed to create Razorpay order", error);
    return Response.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
