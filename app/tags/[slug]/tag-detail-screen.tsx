"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Hash } from "lucide-react";

import { TemplateCard, mapPublishedTemplate, useTemplateInteractions } from "@/components/craft-app";
import type { TemplateTag } from "@/lib/templates/repository";
import type { PublishedTemplate } from "@/lib/templates/types";

export function TagDetailScreen({ tag, publishedTemplates, subscribed, page, total, pageSize }: { tag: TemplateTag; publishedTemplates: PublishedTemplate[]; subscribed: boolean; page: number; total: number; pageSize: number }) {
  const router = useRouter();
  const templates = publishedTemplates.map(mapPublishedTemplate);
  const interactions = useTemplateInteractions();
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <main className="fixed inset-0 w-screen max-w-none overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="min-h-dvh w-screen max-w-none bg-white px-3 pb-8 pt-5 md:px-4 lg:px-5">
        <header><button type="button" aria-label="Back" onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button></header>

        <div className="w-full">
        <section className="mt-9">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-white"><Hash className="h-7 w-7" /></span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{tag.name}</h1>
          <p className="mt-1 text-sm text-black/40">{total} {total === 1 ? "template" : "templates"}</p>
        </section>

        {templates.length ? <div className="mt-7 columns-2 gap-5 sm:columns-3 md:gap-6 lg:columns-4 min-[1033px]:columns-6 xl:columns-7 2xl:columns-9">{templates.map((template) => <div key={template.id} className="mb-5 break-inside-avoid md:mb-6"><TemplateCard template={template} onOpenDetail={() => router.push(`/t/${template.id}`)} interactions={interactions} subscribed={subscribed} /></div>)}</div> : <div className="mt-8 rounded-2xl bg-[#f2f2f2] px-5 py-10 text-center text-sm text-black/45">No templates use this tag yet.</div>}

        {totalPages > 1 ? <nav aria-label="Tag template pages" className="mt-8 flex items-center justify-between gap-3">
          {page > 1 ? <Link href={`/tags/${tag.slug}?page=${page - 1}`} className="rounded-xl bg-[#f2f2f2] px-4 py-2.5 text-sm font-semibold">Previous</Link> : <span />}
          <span className="text-xs text-black/40">{page} of {totalPages}</span>
          {page < totalPages ? <Link href={`/tags/${tag.slug}?page=${page + 1}`} className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white">Next</Link> : <span />}
        </nav> : null}
        </div>
      </div>
    </main>
  );
}
