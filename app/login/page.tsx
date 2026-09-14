"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginMode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    setLoading(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      setLoading(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      router.replace("/");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }
    setMessage("Check your email to confirm your account, then sign in.");
    setMode("signin");
    setPassword("");
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
      <div className="flex min-h-dvh w-full flex-col bg-white px-5 pb-8 pt-5">
        <button type="button" aria-label="Close login" onClick={() => router.push("/")} className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95">
          <X className="h-5 w-5" />
        </button>

        <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col">
        <div className="my-auto py-10">
          <Image src="/lvo.jpg" alt="LVO Crafts" width={56} height={56} priority className="h-14 w-14 rounded-2xl object-cover" />

          <h1 className="mt-6 text-3xl font-semibold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>

          <button type="button" disabled={loading} onClick={signInWithGoogle} className="mt-6 flex h-13 w-full items-center justify-center gap-3 rounded-xl bg-[#f2f2f2] text-sm font-semibold transition hover:bg-[#e9e9e9] active:scale-[0.99] disabled:opacity-50">
            <GoogleIcon /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-black/35"><span className="h-px flex-1 bg-black/8" /><span>or continue with email</span><span className="h-px flex-1 bg-black/8" /></div>

          <form onSubmit={submit} className="space-y-3">
            <label htmlFor="login-email" className="sr-only">Email address</label>
            <input id="login-email" type="email" inputMode="email" autoComplete="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="h-13 w-full rounded-xl bg-[#f2f2f2] px-4 text-base outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />

            <div>
              <label htmlFor="login-password" className="sr-only">Password</label>
              <div className="relative">
                <input id="login-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 6 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="h-13 w-full rounded-xl bg-[#f2f2f2] px-4 pr-12 text-base outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-black/40 transition hover:text-black/70"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {mode === "signin" ? <div className="mt-2 text-right"><Link href="/forgot-password" className="text-xs font-semibold text-black/50 transition hover:text-black">Forgot password?</Link></div> : null}
            </div>

            <button type="submit" disabled={loading || !email.trim() || !password} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <>{mode === "signin" ? "Sign in" : "Sign up"} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}
            className="mt-4 block w-full text-center text-sm text-black/55"
          >
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <span className="font-semibold text-black">{mode === "signin" ? "Sign up" : "Sign in"}</span>
          </button>

          {message ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
        </div>

        <p className="text-center text-[11px] leading-5 text-black/35">By continuing, you agree to the Terms and Privacy Policy.</p>
        </div>
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
