"use client";

import { Check, LoaderCircle, X } from "lucide-react";
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
    <main className="fixed inset-0 h-[100dvh] max-h-screen overflow-hidden overscroll-none bg-black text-black">
      <div className="mx-auto flex h-full max-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-white">
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-6">
          <h1 className="text-xl font-semibold tracking-tight">Subscription</h1>
          <button type="button" aria-label="Close" onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 transition active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4">
          <div className="rounded-2xl border-2 border-black/10 p-5">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">{plan.name} plan</p>
              <p className="text-base font-semibold tracking-tight">{plan.price}</p>
            </div>

            {purchase.billing_type === "one_time" ? (
              <p className="mt-2 text-sm text-black/55">
                Lifetime access{purchasedOn ? ` — purchased on ${purchasedOn}` : ""}. No further action needed, and there&apos;s nothing to cancel.
              </p>
            ) : purchase.cancel_at_period_end ? (
              <p className="mt-2 text-sm text-black/55">
                Your plan won&apos;t renew.{renewsOn ? ` You'll keep access until ${renewsOn}.` : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-black/55">
                {renewsOn ? `Renews automatically on ${renewsOn}.` : "Renews automatically each period."}
              </p>
            )}
          </div>

          {errorMessage ? <p className="mt-4 text-center text-xs font-medium text-red-600">{errorMessage}</p> : null}

          {purchase.billing_type === "subscription" && purchase.gateway === "etsy" ? (
            <p className="mt-6 text-center text-xs text-black/45">
              This plan was activated manually after an Etsy purchase. Contact us to change or cancel it.
            </p>
          ) : purchase.billing_type === "subscription" && purchase.cancel_at_period_end ? (
            purchase.gateway === "razorpay" ? (
              <button
                type="button"
                onClick={() => runAction("/api/payments/resume")}
                disabled={isProcessing}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
              >
                {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Resume subscription
              </button>
            ) : null
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
        </section>
      </div>
    </main>
  );
}
