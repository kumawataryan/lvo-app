import { paypalFetch } from "@/lib/paypal/client";
import { findPurchaseById, findPurchaseByPaypalId, markPurchaseStatus } from "@/lib/payments/repository";

type PaypalWebhookEvent = {
  event_type: string;
  resource: {
    id?: string;
    custom_id?: string;
    billing_agreement_id?: string;
    status?: string;
    billing_info?: { next_billing_time?: string };
  };
};

async function verifySignature(request: Request, rawBody: string, webhookId: string) {
  const headers = request.headers;
  const body = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  };

  const result = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return result.verification_status === "SUCCESS";
}

async function resolvePurchase(resource: PaypalWebhookEvent["resource"]) {
  if (resource.custom_id) {
    const purchase = await findPurchaseById(resource.custom_id);
    if (purchase) return purchase;
  }
  if (resource.id) return findPurchaseByPaypalId("paypal_subscription_id", resource.id);
  return null;
}

export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return Response.json({ error: "Webhook is not configured." }, { status: 503 });

  const rawBody = await request.text();

  let verified: boolean;
  try {
    verified = await verifySignature(request, rawBody, webhookId);
  } catch (error) {
    console.error("Failed to verify PayPal webhook signature", error);
    return Response.json({ error: "Signature verification failed." }, { status: 400 });
  }
  if (!verified) return Response.json({ error: "Invalid signature." }, { status: 400 });

  const body: PaypalWebhookEvent = JSON.parse(rawBody);

  try {
    switch (body.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const purchase = await resolvePurchase(body.resource);
        if (purchase) {
          await markPurchaseStatus(purchase.id, {
            status: "active",
            currentPeriodEnd: body.resource.billing_info?.next_billing_time ?? null,
          });
        }
        break;
      }
      case "PAYMENT.SALE.COMPLETED": {
        // Recurring subscription charge — resource.billing_agreement_id is the subscription id.
        if (body.resource.billing_agreement_id) {
          const purchase = await findPurchaseByPaypalId("paypal_subscription_id", body.resource.billing_agreement_id);
          if (purchase) await markPurchaseStatus(purchase.id, { status: "active" });
        }
        break;
      }
      case "BILLING.SUBSCRIPTION.CANCELLED": {
        const purchase = await resolvePurchase(body.resource);
        if (purchase) await markPurchaseStatus(purchase.id, { status: "cancelled", cancelAtPeriodEnd: false });
        break;
      }
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        const purchase = await resolvePurchase(body.resource);
        if (purchase) await markPurchaseStatus(purchase.id, { status: "paused" });
        break;
      }
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        const purchase = await resolvePurchase(body.resource);
        if (purchase) await markPurchaseStatus(purchase.id, { status: "halted" });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Failed to process PayPal webhook", error);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
