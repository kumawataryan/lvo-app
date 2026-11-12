import { after, NextResponse } from "next/server";

import { sendWelcomeEmailIfNew } from "@/lib/email/welcome-email";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  if (code) {
    const supabase = await createSupabaseAuthServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Welcome emails go out after the redirect so sign-in isn't delayed. Password resets are skipped.
      if (!next.startsWith("/auth/reset-password")) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) after(() => sendWelcomeEmailIfNew(user).catch((emailError) => console.error("Welcome email failed", emailError)));
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
}
