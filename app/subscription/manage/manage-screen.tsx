"use client";

import { LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PLAN_DETAILS, type Gateway, type PlanId } from "@/lib/payments/plans";

type Purchase = {
  id: string;
  plan_id: PlanId;
  billing_type: "subscription" | "one_time";
  gateway: Gateway;
  status: string;
  amount: number;
  currency: string;
  razorpay_subscription_id: string | null;
  paypal_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function formatAmount(amountInMinorUnits: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amountInMinorUnits / 100);
}

export function ManageSubscriptionScreen({ purchase }: { purchase: Purchase }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const plan = PLAN_DETAILS[purchase.plan_id];
  const renewsOn = formatDate(purchase.current_period_end);
  const purchasedOn = formatDate(purchase.created_at);
  const cancelIsImmediate = purchase.gateway === "paypal";

  const runAction = async (endpoint: string) => {
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error || "Something went wrong. Please try again.");
        return;
      }
      setConfirmingCancel(false);
      router.refresh();
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-white px-5 pb-8 pt-5">
        <header className="flex h-11 items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Subscription</h1>
          <button type="button" aria-label="Close" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/?tab=profile"); }} className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2f2f2] transition active:scale-95"><X className="h-5 w-5" /></button>
        </header>

        <section className="mt-8 rounded-2xl bg-black p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-white/50">Current plan</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{plan.name}</h2>
            </div>
            <span className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${purchase.cancel_at_period_end ? "bg-red-500/20 text-red-200" : purchase.billing_type === "one_time" ? "bg-blue-400/20 text-blue-200" : "bg-emerald-400/20 text-emerald-200"}`}>{purchase.cancel_at_period_end ? "Ending" : purchase.billing_type === "one_time" ? "Lifetime" : "Active"}</span>
          </div>
          <p className="mt-6 text-2xl font-semibold tracking-tight">{formatAmount(purchase.amount, purchase.currency)} <span className="text-sm font-normal text-white/50">{purchase.billing_type === "one_time" ? "one-time" : plan.period}</span></p>
          <p className="mt-2 text-xs text-white/50">{purchase.billing_type === "one_time" ? "Lifetime access. No recurring charges." : purchase.cancel_at_period_end ? `Access available until ${renewsOn ?? "the end of the billing period"}.` : renewsOn ? `Renews on ${renewsOn}.` : "Renews automatically."}</p>
        </section>

        <section className="mt-8" aria-label="Subscription details">
          <h2 className="text-sm font-semibold">Plan details</h2>
          <dl className="mt-3 divide-y divide-black/[0.07] rounded-2xl bg-[#f2f2f2] px-4">
            <div className="flex items-center justify-between gap-6 py-4"><dt className="text-sm text-black/45">Billing cycle</dt><dd className="text-right text-sm font-medium">{purchase.billing_type === "one_time" ? "One-time" : plan.period.replace("per ", "Every ")}</dd></div>
            <div className="flex items-center justify-between gap-6 py-4"><dt className="text-sm text-black/45">{purchase.cancel_at_period_end ? "Access ends" : purchase.billing_type === "one_time" ? "Expires" : "Next renewal"}</dt><dd className="text-right text-sm font-medium">{purchase.billing_type === "one_time" ? "Never" : renewsOn ?? "Not available"}</dd></div>
            <div className="flex items-center justify-between gap-6 py-4"><dt className="text-sm text-black/45">Member since</dt><dd className="text-right text-sm font-medium">{purchasedOn ?? "Not available"}</dd></div>
            <div className="flex items-center justify-between gap-6 py-4"><dt className="text-sm text-black/45">Payment provider</dt><dd className="text-right text-sm font-medium capitalize">{purchase.gateway}</dd></div>
          </dl>
        </section>

          {errorMessage ? <p className="mt-4 text-center text-xs font-medium text-red-600">{errorMessage}</p> : null}

          {purchase.billing_type === "subscription" && purchase.gateway === "etsy" ? (
            <p className="mt-6 rounded-2xl bg-[#f2f2f2] px-4 py-4 text-sm leading-6 text-black/55">
              This legacy plan was activated manually. Contact us to change or cancel it.
            </p>
          ) : purchase.billing_type === "subscription" && purchase.cancel_at_period_end ? (
            <div className="mt-6 rounded-2xl bg-red-50 px-4 py-4 text-sm leading-6 text-red-800">Your access stays active until {renewsOn ?? "the end of the billing period"}. After that, you can choose a new plan.</div>
          ) : purchase.billing_type === "subscription" ? (
            confirmingCancel ? (
              <div className="mt-6 rounded-2xl bg-[#f2f2f2] p-4">
                <p className="text-sm font-medium text-black/70">
                  {cancelIsImmediate
                    ? `Cancel your ${plan.name.toLowerCase()} plan? Access ends immediately — this can't be undone.`
                    : `Cancel your ${plan.name.toLowerCase()} plan? You'll keep access until${renewsOn ? ` ${renewsOn}` : " the end of your current period"}, then it won't renew.`}
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setConfirmingCancel(false)} className="h-11 flex-1 rounded-xl bg-white text-sm font-semibold text-black transition active:scale-[0.98]">
                    Keep subscription
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction("/api/payments/cancel")}
                    disabled={isProcessing}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Confirm cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-[#f2f2f2] text-sm font-semibold text-red-600 transition active:scale-[0.98]"
              >
                Cancel subscription
              </button>
            )
          ) : null}
      </div>
    </main>
  );
}
