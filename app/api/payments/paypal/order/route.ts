import { isPaypalConfigured, paypalFetch } from "@/lib/paypal/client";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { createPendingPurchase } from "@/lib/payments/repository";
import { amountInCents, paypalAmountString } from "@/lib/payments/plans";

export async function POST(request: Request) {
  if (!isPaypalConfigured()) {
    return Response.json({ error: "Payments are not configured yet." }, { status: 503 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  const origin = new URL(request.url).origin;

  try {
    const purchaseId = await createPendingPurchase(supabase, {
      userId: user.id,
      planId: "lifetime",
      billingType: "one_time",
      gateway: "paypal",
      amount: amountInCents("lifetime"),
      currency: "USD",
    });

    const order = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ custom_id: purchaseId, amount: { currency_code: "USD", value: paypalAmountString("lifetime") } }],
        application_context: {
          return_url: `${origin}/subscription/paypal/return`,
          cancel_url: `${origin}/subscription?paypal=cancelled`,
          user_action: "PAY_NOW",
          brand_name: "Craft Library",
        },
      }),
    });

    await supabase.from("purchases").update({ paypal_order_id: order.id }).eq("id", purchaseId);

    const approveUrl = order.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href;
    if (!approveUrl) throw new Error("PayPal did not return an approval link.");

    return Response.json({ approveUrl });
  } catch (error) {
    console.error("Failed to create PayPal order", error);
    return Response.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
