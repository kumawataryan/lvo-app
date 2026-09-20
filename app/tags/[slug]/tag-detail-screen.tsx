"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { TemplateCard, TemplateTopBar, mapPublishedTemplate, tabRoute, useTemplateInteractions } from "@/components/craft-app";
import type { TemplateTag } from "@/lib/templates/repository";
import type { PublishedTemplate } from "@/lib/templates/types";

export function TagDetailScreen({ tag, publishedTemplates, subscribed, canAddTemplates, page, total, pageSize }: { tag: TemplateTag; publishedTemplates: PublishedTemplate[]; subscribed: boolean; canAddTemplates: boolean; page: number; total: number; pageSize: number }) {
  const router = useRouter();
  const templates = publishedTemplates.map(mapPublishedTemplate);
  const interactions = useTemplateInteractions();
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <main className="fixed inset-0 flex w-screen max-w-none flex-col bg-white text-black">
      <TemplateTopBar canAddTemplates={canAddTemplates} subscribed={subscribed} activeCategory="" onCategoryChange={() => undefined} categoriesOverride={[]} onTabChange={(tab) => router.push(tabRoute(tab))} />
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-full px-4 pb-16 pt-2 md:px-5 lg:px-6">
        {templates.length ? <div className="columns-2 gap-5 sm:columns-3 md:gap-6 lg:columns-4 min-[1033px]:columns-5 xl:columns-6 2xl:columns-8">{templates.map((template) => <div key={template.id} className="mb-5 break-inside-avoid md:mb-6"><TemplateCard template={template} onOpenDetail={() => router.push(`/t/${template.id}`)} interactions={interactions} subscribed={subscribed} /></div>)}</div> : <div className="rounded-2xl bg-[#f2f2f2] px-5 py-10 text-center text-sm text-black/45">No templates use this tag yet.</div>}

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
