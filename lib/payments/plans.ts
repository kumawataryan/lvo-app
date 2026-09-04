export type PlanId = "monthly" | "yearly" | "lifetime";
/** Etsy remains here for historical purchase records, but is no longer offered at checkout. */
export type Gateway = "razorpay" | "paypal" | "stripe" | "etsy";

type PlanDetails = {
  id: PlanId;
  name: string;
  /** Price in whole dollars (e.g. 1.50, 15, 100). Used by PayPal and Stripe. */
  usdAmount: number;
  /** Formatted dollar price for display, e.g. "$1.50". */
  price: string;
  period: string;
  badge?: string;
  billingType: "subscription" | "one_time";
};

/** Base USD pricing, used by PayPal and Stripe. */
export const PLAN_DETAILS: Record<PlanId, PlanDetails> = {
  monthly: {
    id: "monthly",
    name: "Monthly",
    usdAmount: 1.5,
    price: "$1.50",
    period: "per month",
    billingType: "subscription",
  },
  yearly: {
    id: "yearly",
    name: "Yearly",
    usdAmount: 15,
    price: "$15",
    period: "per year",
    badge: "Save 17%",
    billingType: "subscription",
  },
  lifetime: {
    id: "lifetime",
    name: "Lifetime",
    usdAmount: 100,
    price: "$100",
    period: "one-time",
    billingType: "one_time",
  },
};

type RazorpayPlanDetails = {
  /** Amount in paise (smallest INR unit). */
  amount: number;
  /** Formatted rupee price for display, e.g. "₹129". */
  price: string;
  badge?: string;
};

/**
 * Razorpay pricing (INR, amount in paise). Kept separate from PLAN_DETAILS because this
 * Razorpay account doesn't have International/Export Payments enabled, so it can only
 * charge in INR — USD orders fail with "Currency provided is not supported".
 */
export const RAZORPAY_PLAN_DETAILS: Record<PlanId, RazorpayPlanDetails> = {
  monthly: { amount: 12900, price: "₹129" },
  yearly: { amount: 129900, price: "₹1,299", badge: "Save 16%" },
  lifetime: { amount: 829900, price: "₹8,299" },
};

export const PLAN_ORDER: PlanId[] = ["monthly", "yearly", "lifetime"];

export function isPlanId(value: unknown): value is PlanId {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}

/** PayPal amount in cents (smallest USD unit) — the API wants the integer minor unit. */
export function amountInCents(planId: PlanId) {
  return Math.round(PLAN_DETAILS[planId].usdAmount * 100);
}

/** PayPal wants amounts as a decimal string, e.g. "1.50". */
export function paypalAmountString(planId: PlanId) {
  return PLAN_DETAILS[planId].usdAmount.toFixed(2);
}

export type GatewayInfo = {
  id: Gateway;
  label: string;
  /** Domain used to fetch a brand icon via Google's favicon service. */
  iconDomain: string;
};

export const GATEWAYS: GatewayInfo[] = [
  { id: "razorpay", label: "Razorpay", iconDomain: "razorpay.com" },
  { id: "paypal", label: "PayPal", iconDomain: "paypal.com" },
  { id: "stripe", label: "Stripe", iconDomain: "stripe.com" },
];

export function isGateway(value: unknown): value is Gateway {
  return value === "razorpay" || value === "paypal" || value === "stripe" || value === "etsy";
}

export function faviconUrl(domain: string, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
