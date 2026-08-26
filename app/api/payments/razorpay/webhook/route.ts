import { createHmac, timingSafeEqual } from "node:crypto";

import { findPurchaseByRazorpayId, markPurchaseStatus } from "@/lib/payments/repository";

type RazorpayWebhookPayload = {
  event: string;
  payload: {
    payment?: { entity?: { id?: string; order_id?: string } };
    subscription?: { entity?: { id?: string; current_end?: number } };
  };
};

function isValidSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });

  const signature = request.headers.get("x-razorpay-signature");
  const rawBody = await request.text();

  if (!signature || !isValidSignature(rawBody, signature, webhookSecret)) {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    switch (body.event) {
      case "payment.captured": {
        const payment = body.payload.payment?.entity;
        if (payment?.order_id) {
          const purchase = await findPurchaseByRazorpayId("razorpay_order_id", payment.order_id);
          if (purchase) {
            await markPurchaseStatus(purchase.id, { status: "completed", razorpayPaymentId: payment.id });
          }
        }
        break;
      }
      case "subscription.activated":
      case "subscription.charged": {
        const subscription = body.payload.subscription?.entity;
        if (subscription?.id) {
          const purchase = await findPurchaseByRazorpayId("razorpay_subscription_id", subscription.id);
          if (purchase) {
            await markPurchaseStatus(purchase.id, {
              status: "active",
              currentPeriodEnd: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null,
            });
          }
        }
        break;
      }
      case "subscription.pending":
      case "subscription.halted": {
        const subscription = body.payload.subscription?.entity;
        if (subscription?.id) {
          const purchase = await findPurchaseByRazorpayId("razorpay_subscription_id", subscription.id);
          if (purchase) await markPurchaseStatus(purchase.id, { status: "halted" });
        }
        break;
      }
      case "subscription.cancelled": {
        const subscription = body.payload.subscription?.entity;
        if (subscription?.id) {
          const purchase = await findPurchaseByRazorpayId("razorpay_subscription_id", subscription.id);
          if (purchase) await markPurchaseStatus(purchase.id, { status: "cancelled" });
        }
        break;
      }
      case "subscription.paused": {
        const subscription = body.payload.subscription?.entity;
        if (subscription?.id) {
          const purchase = await findPurchaseByRazorpayId("razorpay_subscription_id", subscription.id);
          if (purchase) await markPurchaseStatus(purchase.id, { status: "paused" });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Failed to process Razorpay webhook", error);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
