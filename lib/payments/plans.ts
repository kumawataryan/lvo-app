export type PlanId = "monthly" | "yearly" | "lifetime";

type PlanDetails = {
  id: PlanId;
  name: string;
  /** Amount in paise (smallest INR unit). */
  amount: number;
  /** Formatted rupee price for display, e.g. "₹129". */
  price: string;
  period: string;
  badge?: string;
  billingType: "subscription" | "one_time";
};

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

export const PLAN_ORDER: PlanId[] = ["monthly", "yearly", "lifetime"];

export function isPlanId(value: unknown): value is PlanId {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}
