"use client";

import Image from "next/image";
import { Check, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { loadRazorpayCheckout, type RazorpaySuccessResponse } from "@/lib/razorpay/checkout";
import { GATEWAYS, PLAN_DETAILS, PLAN_ORDER, RAZORPAY_PLAN_DETAILS, faviconUrl, type Gateway, type PlanId } from "@/lib/payments/plans";

const benefits = [
  "Unlimited printable downloads",
  "Easy step-by-step craft guides",
  "Fresh activities added regularly",
  "High-quality, print-ready files",
];

function planDisplay(planId: PlanId, gateway: Gateway | null) {
  const base = PLAN_DETAILS[planId];
  if (gateway === "razorpay") {
    const inr = RAZORPAY_PLAN_DETAILS[planId];
    return { name: base.name, period: base.period, price: inr.price, badge: inr.badge };
  }
  return { name: base.name, period: base.period, price: base.price, badge: base.badge };
}

export function SubscriptionScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("monthly");
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.has("stripe") ? "stripe" : "paypal";
    const result = params.get(provider);
    if (result !== "cancelled" && result !== "error") return;
    const timeout = window.setTimeout(() => {
      setErrorMessage(result === "cancelled" ? "Checkout was cancelled." : "We couldn't confirm your payment. Contact support if you were charged.");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const startRazorpayCheckout = async () => {
    await loadRazorpayCheckout();
    const plan = PLAN_DETAILS[selectedPlan];
    const endpoint = plan.billingType === "one_time" ? "/api/payments/razorpay/order" : "/api/payments/razorpay/subscription";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: plan.billingType === "subscription" ? JSON.stringify({ planId: selectedPlan }) : undefined,
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      setErrorMessage(data.error || "Unable to start checkout. Please try again.");
      setIsProcessing(false);
      return;
    }

    const handleSuccess = async (razorpayResponse: RazorpaySuccessResponse) => {
      try {
        const verifyResponse = await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(razorpayResponse),
        });
        if (!verifyResponse.ok) {
          setErrorMessage("We couldn't confirm your payment. Contact support if you were charged.");
          return;
        }
        router.push("/");
      } finally {
        setIsProcessing(false);
      }
    };

    const razorpay = new window.Razorpay!({
      key: data.keyId,
      name: "Craft Library",
      description: `${plan.name} plan`,
      theme: { color: "#000000" },
      ...(plan.billingType === "one_time"
        ? { order_id: data.orderId, amount: data.amount, currency: data.currency }
        : { subscription_id: data.subscriptionId }),
      handler: handleSuccess,
      modal: { ondismiss: () => setIsProcessing(false) },
    });

    razorpay.on("payment.failed", (failure) => {
      setErrorMessage(failure.error.description || "Payment failed. Please try again.");
      setIsProcessing(false);
    });

    razorpay.open();
  };

  const startPaypalCheckout = async () => {
    const plan = PLAN_DETAILS[selectedPlan];
    const endpoint = plan.billingType === "one_time" ? "/api/payments/paypal/order" : "/api/payments/paypal/subscription";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: plan.billingType === "subscription" ? JSON.stringify({ planId: selectedPlan }) : undefined,
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    const data = await response.json();
    if (!response.ok || !data.approveUrl) {
      setErrorMessage(data.error || "Unable to start checkout. Please try again.");
      setIsProcessing(false);
      return;
    }

    window.location.href = data.approveUrl;
  };

  const startStripeCheckout = async () => {
    const response = await fetch("/api/payments/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: selectedPlan }),
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    const data = await response.json();
    if (!response.ok || !data.checkoutUrl) {
      setErrorMessage(data.error || "Unable to start checkout. Please try again.");
      setIsProcessing(false);
      return;
    }
    window.location.href = data.checkoutUrl;
  };

  const startCheckout = async () => {
    if (!selectedGateway) return;
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      if (selectedGateway === "razorpay") await startRazorpayCheckout();
      else if (selectedGateway === "paypal") await startPaypalCheckout();
      else await startStripeCheckout();
    } catch {
      setErrorMessage("Unable to start checkout. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-y-auto overscroll-contain bg-white text-black">
      <div className="min-h-full w-full bg-white">
        <div className="px-4 pt-4 md:px-6 md:pt-6 lg:px-8">
          <button type="button" aria-label="Close" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] text-black transition active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto w-full max-w-none min-[1033px]:max-w-2xl">
        <section className="px-5 pb-6 pt-3 md:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight">Unlimited creativity</h1>
          <p className="mt-2 text-sm leading-5 text-black/50">Easy, ready-to-print crafts for creative little hands.</p>

          <div className="mt-6 grid w-full grid-cols-1 gap-2.5">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm font-medium text-black/72">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-white"><Check className="h-3.5 w-3.5" strokeWidth={2.5} /></span>
                {benefit}
              </div>
            ))}
          </div>

          <p className="mb-2 mt-7 text-xs font-semibold text-black/45">Choose a plan</p>
          <div className="grid grid-cols-3 gap-2.5">
            {PLAN_ORDER.map((planId) => {
              const plan = planDisplay(planId, selectedGateway);
              const isSelected = planId === selectedPlan;
              return (
                <button
                  key={planId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedPlan(planId)}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl border-[3px] px-2 pb-4 pt-6 text-center transition active:scale-[0.97] ${
                    isSelected
                      ? "border-black bg-black/3 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
                      : "border-black/20 bg-white"
                  }`}
                >
                  {plan.badge ? (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black px-2 py-0.5 text-[9px] font-semibold text-white">
                      {plan.badge}
                    </span>
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border-2 transition ${
                      isSelected ? "border-black bg-black" : "border-black/15 bg-transparent"
                    }`}
                  >
                    {isSelected ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} /> : null}
                  </span>
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="text-lg font-semibold tracking-tight">{plan.price}</p>
                  <p className="text-[10px] text-black/42">{plan.period}</p>
                </button>
              );
            })}
          </div>

          <p className="mb-2 mt-7 text-xs font-semibold text-black/45">Payment method</p>
          <div className="grid grid-cols-3 gap-2.5">
            {GATEWAYS.map((gateway) => {
              const isSelected = gateway.id === selectedGateway;
              return (
                <button
                  key={gateway.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedGateway(gateway.id);
                    setErrorMessage(null);
                  }}
                  className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border-[3px] px-2 py-3 transition active:scale-[0.97] ${
                    isSelected ? "border-black bg-black/3" : "border-black/20 bg-white"
                  }`}
                >
                  <Image src={faviconUrl(gateway.iconDomain)} alt="" width={32} height={32} className="h-8 w-8 rounded-lg" unoptimized />
                  <span className="text-[11px] font-semibold">{gateway.label}</span>
                </button>
              );
            })}
          </div>

          {errorMessage ? <p role="alert" className="mt-4 text-center text-xs font-medium text-red-600">{errorMessage}</p> : null}

          <button
            type="button"
            onClick={startCheckout}
            disabled={isProcessing || !selectedGateway}
            className="mt-8 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-black text-base font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition active:scale-[0.99] disabled:opacity-40"
          >
            {isProcessing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {isProcessing ? "Processing…" : "Continue"}
          </button>

          <p className="mx-auto mt-6 max-w-xs text-center text-[9px] leading-snug text-black/25">
            Monthly and yearly plans auto-renew until canceled; manage or cancel anytime in your account settings. All purchases, including the one-time Lifetime plan, are final and non-refundable. By continuing, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
            <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
          </p>
        </section>
        </div>
      </div>
    </main>
  );
}
