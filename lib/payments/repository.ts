import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/payments/plans";

type PurchaseStatus = "created" | "authenticated" | "active" | "paused" | "halted" | "cancelled" | "completed" | "failed";

export async function createPendingPurchase(
  supabase: SupabaseClient,
  params: {
    userId: string;
    planId: PlanId;
    billingType: "subscription" | "one_time";
    amount: number;
    razorpayOrderId?: string;
    razorpaySubscriptionId?: string;
  },
) {
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      user_id: params.userId,
      plan_id: params.planId,
      billing_type: params.billingType,
      amount: params.amount,
      currency: "INR",
      razorpay_order_id: params.razorpayOrderId ?? null,
      razorpay_subscription_id: params.razorpaySubscriptionId ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Unable to record purchase: ${error.message}`);
  return data.id as string;
}

export async function findPurchaseByRazorpayId(field: "razorpay_order_id" | "razorpay_subscription_id", value: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("purchases").select("id, user_id, plan_id, billing_type").eq(field, value).maybeSingle();
  if (error) throw new Error(`Unable to look up purchase: ${error.message}`);
  return data;
}

export async function markPurchaseStatus(
  id: string,
  updates: {
    status: PurchaseStatus;
    razorpayPaymentId?: string;
    currentPeriodEnd?: string | null;
  },
) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("purchases")
    .update({
      status: updates.status,
      ...(updates.razorpayPaymentId ? { razorpay_payment_id: updates.razorpayPaymentId } : {}),
      ...(updates.currentPeriodEnd !== undefined ? { current_period_end: updates.currentPeriodEnd } : {}),
    })
    .eq("id", id);

  if (error) throw new Error(`Unable to update purchase: ${error.message}`);
}
