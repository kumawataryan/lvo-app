"use client";

import { useState, type FormEvent } from "react";

import { TemplateTopBar, useAppShell } from "@/components/craft-app";

type Status = "idle" | "sending" | "sent" | "error";

const inputClass = "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black/40";

export default function ContactPage() {
  const { subscribed } = useAppShell();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          website: data.get("website"),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "We could not send your message. Please try again.");
        setStatus("error");
        return;
      }
      form.reset();
      setStatus("sent");
    } catch {
      setError("We could not send your message. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white text-black">
      <TemplateTopBar activeCategory="" onCategoryChange={() => undefined} subscribed={subscribed} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-2">
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Contact us</h1>
          <p className="mt-2 text-base leading-7 text-black/70">
            Have a question, need help with a template, or want a custom one made? Send us a message and we will reply within 24 hours.
          </p>

          {status === "sent" ? (
            <div className="mt-8 rounded-2xl border border-black/10 bg-[#fafafa] px-5 py-6 text-sm">
              <p className="font-medium text-black">Thanks, your message was sent.</p>
              <p className="mt-1 text-black/60">We will get back to you within 24 hours.</p>
              <button type="button" onClick={() => setStatus("idle")} className="mt-4 text-sm font-medium text-black underline">Send another message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {/* Honeypot: hidden from people, filled by bots. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

              <label className="block text-sm font-medium text-black">
                Name
                <input name="name" type="text" required maxLength={100} autoComplete="name" placeholder="Your name" className={inputClass} />
              </label>

              <label className="block text-sm font-medium text-black">
                Email
                <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" className={inputClass} />
              </label>

              <label className="block text-sm font-medium text-black">
                Message
                <textarea name="message" required rows={6} maxLength={2000} placeholder="How can we help?" className={`${inputClass} resize-y`} />
              </label>

              {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand/90 active:scale-95 disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}

          <p className="mt-8 text-sm leading-6 text-black/55">
            Or email us directly at{" "}
            <a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
