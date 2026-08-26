import { createHmac, timingSafeEqual } from "node:crypto";

import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { findPurchaseByRazorpayId, markPurchaseStatus } from "@/lib/payments/repository";

type VerifyBody = {
  razorpay_payment_id?: unknown;
  razorpay_order_id?: unknown;
  razorpay_subscription_id?: unknown;
  razorpay_signature?: unknown;
};

function verifySignature(payload: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return Response.json({ error: "Payments are not configured yet." }, { status: 503 });

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

  let body: VerifyBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const subscriptionId = typeof body.razorpay_subscription_id === "string" ? body.razorpay_subscription_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

  if (!paymentId || !signature || (!orderId && !subscriptionId)) {
    return Response.json({ error: "Missing payment details." }, { status: 400 });
  }

  const payload = orderId ? `${orderId}|${paymentId}` : `${paymentId}|${subscriptionId}`;
  if (!verifySignature(payload, signature, keySecret)) {
    return Response.json({ error: "Payment could not be verified." }, { status: 400 });
  }

  const purchase = await findPurchaseByRazorpayId(orderId ? "razorpay_order_id" : "razorpay_subscription_id", orderId || subscriptionId);
  if (!purchase || purchase.user_id !== user.id) {
    return Response.json({ error: "Purchase not found." }, { status: 404 });
  }

  await markPurchaseStatus(purchase.id, {
    status: orderId ? "completed" : "active",
    razorpayPaymentId: paymentId,
  });

  return Response.json({ ok: true, planId: purchase.plan_id });
}
