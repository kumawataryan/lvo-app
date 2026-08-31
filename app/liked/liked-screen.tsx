"use client";

import { ArrowLeft, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LibraryQuickActions, TemplateCard, mapPublishedTemplate, useTemplateInteractions, type Template } from "@/components/craft-app";
import type { PublishedTemplate } from "@/lib/templates/types";

export function LikedScreen({ templates: publishedTemplates }: { templates: PublishedTemplate[] }) {
  const router = useRouter();
  const templates = publishedTemplates.map(mapPublishedTemplate);
  const interactions = useTemplateInteractions();
  const [quickTemplate, setQuickTemplate] = useState<Template | null>(null);

  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-white px-4 pb-8 pt-5">
        <header>
          <button type="button" aria-label="Back to profile" onClick={() => router.push("/?tab=profile")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        </header>

        <section className="mt-9">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f2f2f2] text-red-500"><Heart className="h-6 w-6" fill="currentColor" /></span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Liked</h1>
          <p className="mt-1 text-sm text-black/40">{templates.length} {templates.length === 1 ? "template" : "templates"}</p>
        </section>

        {templates.length ? <div className="mt-7 grid grid-cols-2 gap-2">{templates.map((template) => <TemplateCard key={template.id} template={template} statusIcon="like" onOpenDetail={() => router.push(`/templates/${template.slug}`)} onQuickActions={() => setQuickTemplate(template)} />)}</div> : <div className="mt-8 rounded-2xl bg-[#f2f2f2] px-5 py-10 text-center text-sm text-black/45">No liked templates</div>}
      </div>
      {quickTemplate ? <LibraryQuickActions template={quickTemplate} interactions={interactions} onClose={() => setQuickTemplate(null)} /> : null}
    </main>
  );
}
