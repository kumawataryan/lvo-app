"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      if (!data.user) setMessage("This reset link is invalid or has expired. Request a new one from the login page.");
      setReady(true);
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6) return;

    setLoading(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="flex min-h-dvh w-full flex-col bg-white px-5 pb-8 pt-5">
        <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col">
          <div className="my-auto py-10">
            <Image src="/lvo.jpg" alt="LVO Crafts" width={56} height={56} priority className="h-14 w-14 rounded-2xl object-cover" />

            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Set a new password</h1>
            <p className="mt-2 text-sm leading-6 text-black/50">Choose a password to use next time you sign in.</p>

            <form onSubmit={submit} className="mt-8 space-y-3">
              <label htmlFor="new-password" className="sr-only">New password</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  autoFocus
                  disabled={!ready}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New password"
                  className="h-13 w-full rounded-xl bg-[#f2f2f2] px-4 pr-12 text-base outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2"
                />
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
              <button type="submit" disabled={loading || !ready || password.length < 6} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : "Save password"}
              </button>
            </form>

            {message ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
