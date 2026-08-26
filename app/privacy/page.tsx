"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <main className="mx-auto min-h-screen w-full max-w-[600px] bg-white px-5 pb-16 pt-6 text-black">
      <button type="button" aria-label="Back" onClick={() => router.back()} className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-black/5 transition active:scale-95">
        <ChevronLeft className="h-5 w-5" />
      </button>

      <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-6 text-sm leading-relaxed text-black/70">
        This Privacy Policy explains how the app collects, uses, and protects your information. Placeholder content — replace with your actual privacy policy before launch.
      </p>
    </main>
  );
}
