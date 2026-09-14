"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoading(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <main className="fixed inset-0 overflow-y-auto bg-white text-black">
      <div className="flex min-h-dvh w-full flex-col px-5 pb-8 pt-5">
        <Link href="/login" aria-label="Back to sign in" className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="mx-auto my-auto w-full max-w-xl py-10">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></span>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">Check your email</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-black/50">We sent a password reset link to <span className="font-semibold text-black">{email.trim()}</span>.</p>
              <Link href="/login" className="mt-8 flex h-13 w-full items-center justify-center rounded-xl bg-black text-sm font-semibold text-white">Back to sign in</Link>
              <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-medium text-black/50">Use a different email</button>
            </div>
          ) : (
            <>
              <Image src="/lvo.jpg" alt="LVO Crafts" width={56} height={56} preload className="h-14 w-14 rounded-2xl object-cover" />
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">Reset your password</h1>
              <p className="mt-2 text-sm leading-6 text-black/50">Enter the email you use for LVO Crafts. We’ll send you a secure reset link.</p>

              <form onSubmit={submit} className="mt-8 space-y-3">
                <label htmlFor="reset-email" className="sr-only">Email address</label>
                <input id="reset-email" type="email" inputMode="email" autoComplete="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="h-13 w-full rounded-xl bg-[#f2f2f2] px-4 text-base outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
                <button type="submit" disabled={loading || !email.trim()} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
                  {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <>Send reset link <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
              {message ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
