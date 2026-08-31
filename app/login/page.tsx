"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginStep = "email" | "code";
const OTP_LENGTH = 8;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const codeInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoading(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEmail(normalizedEmail);
    setCode("");
    setStep("code");
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) return;

    setLoading(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setLoading(false);

    if (error) {
      setMessage("That code is invalid or has expired. Try again.");
      return;
    }

    router.replace("/");
    router.refresh();
  };

  const updateCodeDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const digits = code.split("");
    if (digit) digits[index] = digit;
    else digits.splice(index, 1);
    setCode(digits.filter(Boolean).join("").slice(0, OTP_LENGTH));
    if (digit && index < OTP_LENGTH - 1) codeInputsRef.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !code[index] && index > 0) codeInputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) codeInputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) codeInputsRef.current[index + 1]?.focus();
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    if (error) {
      setLoading(false);
      setMessage(error.message);
    }
  };

  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-5 pb-8 pt-5">
        <button type="button" aria-label="Close login" onClick={() => router.push("/")} className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95">
          <X className="h-5 w-5" />
        </button>

        <div className="my-auto py-10">
          <Image src="/lvo.jpg" alt="LVO Crafts" width={56} height={56} priority className="h-14 w-14 rounded-2xl object-cover" />

          <h1 className="mt-6 text-3xl font-semibold tracking-tight">{step === "email" ? "Welcome" : "Check your email"}</h1>
          <p className="mt-2 text-sm leading-6 text-black/50">
            {step === "email" ? "Sign in or create your account. No password needed." : `Enter the eight-digit code sent to ${email}.`}
          </p>

          {step === "email" ? (
            <>
              <form onSubmit={sendCode} className="mt-8 space-y-3">
                <label htmlFor="login-email" className="sr-only">Email address</label>
                <input id="login-email" type="email" inputMode="email" autoComplete="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="h-13 w-full rounded-xl bg-[#f2f2f2] px-4 text-base outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
                <button type="submit" disabled={loading || !email.trim()} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
                  {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs text-black/35"><span className="h-px flex-1 bg-black/8" /><span>or</span><span className="h-px flex-1 bg-black/8" /></div>

              <button type="button" disabled={loading} onClick={signInWithGoogle} className="flex h-13 w-full items-center justify-center gap-3 rounded-xl border border-black/10 bg-white text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50">
                <GoogleIcon /> Continue with Google
              </button>
            </>
          ) : (
            <form onSubmit={verifyCode} className="mt-8">
              <fieldset>
                <legend className="sr-only">Eight-digit verification code</legend>
                <div
                  className="grid grid-cols-8 gap-1.5"
                  onPaste={(event) => {
                    const pastedCode = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
                    if (!pastedCode) return;
                    event.preventDefault();
                    setCode(pastedCode);
                    codeInputsRef.current[Math.min(pastedCode.length, OTP_LENGTH) - 1]?.focus();
                  }}
                >
                  {Array.from({ length: OTP_LENGTH }, (_, index) => (
                    <input
                      key={index}
                      ref={(element) => { codeInputsRef.current[index] = element; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Verification code digit ${index + 1}`}
                      maxLength={1}
                      autoFocus={index === 0}
                      value={code[index] ?? ""}
                      onChange={(event) => updateCodeDigit(index, event.target.value)}
                      onKeyDown={(event) => handleCodeKeyDown(index, event)}
                      onFocus={(event) => event.currentTarget.select()}
                      className="aspect-square min-w-0 rounded-xl bg-[#f2f2f2] text-center text-xl font-semibold outline-none ring-black/10 transition focus:ring-2"
                    />
                  ))}
                </div>
              </fieldset>
              <button type="submit" disabled={loading || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)} className="mt-4 flex h-13 w-full items-center justify-center rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : "Verify and continue"}
              </button>
              <div className="mt-5 flex items-center justify-center gap-4 text-sm font-medium">
                <button type="button" disabled={loading} onClick={() => void sendCode()} className="text-black/55 disabled:opacity-40">{loading ? "Sending…" : "Resend code"}</button>
                <span className="h-4 w-px bg-black/10" />
                <button type="button" onClick={() => { setStep("email"); setCode(""); setMessage(null); }} className="text-black/55">Change email</button>
              </div>
            </form>
          )}

          {message ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
        </div>

        <p className="text-center text-[11px] leading-5 text-black/35">By continuing, you agree to the Terms and Privacy Policy.</p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.48l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6.01c1.47 0 2.78.5 3.81 1.49l2.88-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
    </svg>
  );
}
