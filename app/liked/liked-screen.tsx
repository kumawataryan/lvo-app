"use client";

import { ArrowLeft, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LibraryQuickActions, TemplateCard, mapPublishedTemplate, useTemplateInteractions, type Template } from "@/components/craft-app";
import type { PublishedTemplate } from "@/lib/templates/types";

export function LikedScreen({ templates: publishedTemplates, subscribed }: { templates: PublishedTemplate[]; subscribed: boolean }) {
  const router = useRouter();
  const templates = publishedTemplates.map(mapPublishedTemplate);
  const interactions = useTemplateInteractions();
  const [quickTemplate, setQuickTemplate] = useState<Template | null>(null);

  return (
    <main className="fixed inset-0 w-screen max-w-none overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="min-h-dvh w-screen max-w-none bg-white px-3 pb-8 pt-5 md:px-4 lg:px-5">
        <header>
          <button type="button" aria-label="Back to profile" onClick={() => router.push("/profile")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        </header>

        <div className="w-full">
        <section className="mt-9">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f2f2f2] text-red-500"><Heart className="h-6 w-6" fill="currentColor" /></span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Liked</h1>
          <p className="mt-1 text-sm text-black/40">{templates.length} {templates.length === 1 ? "template" : "templates"}</p>
        </section>

        {templates.length ? <div className="mt-7 columns-2 gap-5 sm:columns-3 md:gap-6 lg:columns-4 min-[1033px]:columns-6 xl:columns-7 2xl:columns-9">{templates.map((template) => <div key={template.id} className="mb-5 break-inside-avoid md:mb-6"><TemplateCard template={template} statusIcon="like" onOpenDetail={() => router.push(`/t/${template.id}`)} onQuickActions={() => setQuickTemplate(template)} /></div>)}</div> : <div className="mt-8 rounded-2xl bg-[#f2f2f2] px-5 py-10 text-center text-sm text-black/45">No liked templates</div>}
        </div>
      </div>
      {quickTemplate ? <LibraryQuickActions template={quickTemplate} interactions={interactions} subscribed={subscribed} onClose={() => setQuickTemplate(null)} /> : null}
    </main>
  );
}
