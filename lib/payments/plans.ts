export type PlanId = "monthly" | "yearly" | "lifetime";
export type Gateway = "razorpay" | "paypal" | "etsy";

type PlanDetails = {
  id: PlanId;
  name: string;
  /** Amount in paise (smallest INR unit). Used for Razorpay. */
  amount: number;
  /** Formatted rupee price for display, e.g. "₹129". */
  price: string;
  period: string;
  badge?: string;
  billingType: "subscription" | "one_time";
};

/** Razorpay pricing (INR, amount in paise) — the default/primary gateway. */
export const PLAN_DETAILS: Record<PlanId, PlanDetails> = {
  monthly: {
    id: "monthly",
    name: "Monthly",
    amount: 12900,
    price: "₹129",
    period: "per month",
    billingType: "subscription",
  },
  yearly: {
    id: "yearly",
    name: "Yearly",
    amount: 129900,
    price: "₹1,299",
    period: "per year",
    badge: "Save 16%",
    billingType: "subscription",
  },
  lifetime: {
    id: "lifetime",
    name: "Lifetime",
    amount: 829900,
    price: "₹8,299",
    period: "one-time",
    billingType: "one_time",
  },
};

type PaypalPlanDetails = {
  /** Decimal string amount, e.g. "1.50" — PayPal's API expects amounts as strings. */
  amount: string;
  /** Formatted dollar price for display, e.g. "$1.50". */
  price: string;
  badge?: string;
};

/** PayPal pricing (USD) — for international customers outside India. */
export const PAYPAL_PLAN_DETAILS: Record<PlanId, PaypalPlanDetails> = {
  monthly: { amount: "1.50", price: "$1.50" },
  yearly: { amount: "15.00", price: "$15", badge: "Save 17%" },
  lifetime: { amount: "100.00", price: "$100" },
};

export const PLAN_ORDER: PlanId[] = ["monthly", "yearly", "lifetime"];

export function isPlanId(value: unknown): value is PlanId {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}

export type GatewayInfo = {
  id: Gateway;
  label: string;
  /** Domain used to fetch a brand icon via Google's favicon service. */
  iconDomain: string;
  currency: "INR" | "USD" | null;
};

export const GATEWAYS: GatewayInfo[] = [
  { id: "razorpay", label: "Razorpay", iconDomain: "razorpay.com", currency: "INR" },
  { id: "paypal", label: "PayPal", iconDomain: "paypal.com", currency: "USD" },
  { id: "etsy", label: "Etsy", iconDomain: "etsy.com", currency: null },
];

export function isGateway(value: unknown): value is Gateway {
  return value === "razorpay" || value === "paypal" || value === "etsy";
}

export function faviconUrl(domain: string, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
