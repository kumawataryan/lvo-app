import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Gateway, PlanId } from "@/lib/payments/plans";

type PurchaseStatus = "created" | "authenticated" | "active" | "paused" | "halted" | "cancelled" | "completed" | "failed";

export async function createPendingPurchase(
  supabase: SupabaseClient,
  params: {
    userId: string;
    planId: PlanId;
    billingType: "subscription" | "one_time";
    gateway: Gateway;
    amount: number;
    currency: string;
    razorpayOrderId?: string;
    razorpaySubscriptionId?: string;
    paypalOrderId?: string;
    paypalSubscriptionId?: string;
    externalReference?: string;
  },
) {
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      user_id: params.userId,
      plan_id: params.planId,
      billing_type: params.billingType,
      gateway: params.gateway,
      amount: params.amount,
      currency: params.currency,
      razorpay_order_id: params.razorpayOrderId ?? null,
      razorpay_subscription_id: params.razorpaySubscriptionId ?? null,
      paypal_order_id: params.paypalOrderId ?? null,
      paypal_subscription_id: params.paypalSubscriptionId ?? null,
      external_reference: params.externalReference ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Unable to record purchase: ${error.message}`);
  return data.id as string;
}

export async function hasActiveSubscription(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "completed"])
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Unable to check subscription: ${error.message}`);
  return Boolean(data);
}

export async function findPurchaseByRazorpayId(field: "razorpay_order_id" | "razorpay_subscription_id", value: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("purchases").select("id, user_id, plan_id, billing_type").eq(field, value).maybeSingle();
  if (error) throw new Error(`Unable to look up purchase: ${error.message}`);
  return data;
}

export async function findPurchaseByPaypalId(field: "paypal_order_id" | "paypal_subscription_id", value: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("purchases").select("id, user_id, plan_id, billing_type").eq(field, value).maybeSingle();
  if (error) throw new Error(`Unable to look up purchase: ${error.message}`);
  return data;
}

export async function findPurchaseById(id: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("purchases").select("id, user_id, plan_id, billing_type").eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to look up purchase: ${error.message}`);
  return data;
}

export async function getActivePurchase(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select(
      "id, plan_id, billing_type, gateway, status, amount, currency, razorpay_subscription_id, paypal_subscription_id, current_period_end, cancel_at_period_end, created_at",
    )
    .eq("user_id", userId)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Unable to load subscription: ${error.message}`);
  return data;
}

export async function markPurchaseStatus(
  id: string,
  updates: {
    status: PurchaseStatus;
    razorpayPaymentId?: string;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  },
) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("purchases")
    .update({
      status: updates.status,
      ...(updates.razorpayPaymentId ? { razorpay_payment_id: updates.razorpayPaymentId } : {}),
      ...(updates.currentPeriodEnd !== undefined ? { current_period_end: updates.currentPeriodEnd } : {}),
      ...(updates.cancelAtPeriodEnd !== undefined ? { cancel_at_period_end: updates.cancelAtPeriodEnd } : {}),
    })
    .eq("id", id);

  if (error) throw new Error(`Unable to update purchase: ${error.message}`);
}

export async function setCancelAtPeriodEnd(id: string, cancelAtPeriodEnd: boolean) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("purchases").update({ cancel_at_period_end: cancelAtPeriodEnd }).eq("id", id);
  if (error) throw new Error(`Unable to update purchase: ${error.message}`);
}
