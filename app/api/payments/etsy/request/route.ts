import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { createPendingPurchase } from "@/lib/payments/repository";
import { PAYPAL_PLAN_DETAILS, isPlanId } from "@/lib/payments/plans";

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  let body: { planId?: unknown; orderReference?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const planId = body.planId;
  if (!isPlanId(planId)) return Response.json({ error: "Invalid plan." }, { status: 400 });

  const orderReference = typeof body.orderReference === "string" ? body.orderReference.trim().slice(0, 200) : "";

  try {
    await createPendingPurchase(supabase, {
      userId: user.id,
      planId,
      billingType: planId === "lifetime" ? "one_time" : "subscription",
      gateway: "etsy",
      amount: Math.round(Number(PAYPAL_PLAN_DETAILS[planId].amount) * 100),
      currency: "USD",
      externalReference: orderReference || undefined,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to record Etsy purchase request", error);
    return Response.json({ error: "Unable to save your request. Please try again." }, { status: 500 });
  }
}
