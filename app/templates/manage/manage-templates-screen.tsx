"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, LoaderCircle, Pencil, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export type OwnedTemplateSummary = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  thumbnailUrl: string | null;
  updatedAt: string;
};

const STATUS_LABEL: Record<OwnedTemplateSummary["status"], string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const STATUS_TONE: Record<OwnedTemplateSummary["status"], string> = {
  draft: "bg-black/[0.06] text-black/50",
  published: "bg-emerald-100 text-emerald-700",
  archived: "bg-red-100 text-red-700",
};

export function ManageTemplatesScreen({ initialTemplates, initialHasMore, pageSize }: { initialTemplates: OwnedTemplateSummary[]; initialHasMore: boolean; pageSize: number }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastFetchedSearch = useRef(search);

  const fetchPage = async (offset: number, searchTerm: string, replace: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ offset: String(offset), limit: String(pageSize) });
      if (searchTerm) params.set("search", searchTerm);
      const response = await fetch(`/api/templates/mine?${params.toString()}`);
      const result = await response.json() as { templates?: OwnedTemplateSummary[]; hasMore?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load templates.");
      setTemplates((current) => (replace ? (result.templates ?? []) : [...current, ...(result.templates ?? [])]));
      setHasMore(Boolean(result.hasMore));
    } catch {
      // Best-effort: leave the list as-is if a page fails to load.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lastFetchedSearch.current === search) return;
    const timer = setTimeout(() => {
      lastFetchedSearch.current = search;
      void fetchPage(0, search, true);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    const root = mainRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loading) void fetchPage(templates.length, search, false);
    }, { root, rootMargin: "200px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, templates.length, search]);

  return (
    <main ref={mainRef} className="fixed inset-0 w-screen max-w-none overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="min-h-dvh w-screen max-w-none bg-white px-3 pb-8 pt-5 md:px-4 lg:px-5">
        <header className="flex items-center justify-between">
          <button type="button" aria-label="Back to profile" onClick={() => router.push("/profile")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => router.push("/templates/new")} className="flex h-11 items-center gap-1.5 rounded-xl bg-black px-4 text-sm font-semibold text-white transition active:scale-95"><Plus className="h-4 w-4" />Add template</button>
        </header>

        <div className="mx-auto mt-6 w-full max-w-2xl">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" strokeWidth={2.25} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your templates"
              aria-label="Search your templates"
              className="h-12 w-full rounded-xl bg-[#f2f2f2] pl-11 pr-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2"
            />
          </div>

          {templates.length ? (
            <div className="mt-5 space-y-2.5">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => router.push(`/templates/${template.id}/edit`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-[#f2f2f2] p-3 text-left transition active:scale-[0.98]"
                >
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
                    {template.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={template.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{template.title}</span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATUS_TONE[template.status]}`}>{STATUS_LABEL[template.status]}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-black/45"><Pencil className="h-3 w-3" />Edit</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-black/30" />
                </button>
              ))}
            </div>
          ) : !loading ? (
            <div className="mt-5 rounded-2xl bg-[#f2f2f2] px-5 py-10 text-center text-sm text-black/45">
              {search ? "No templates match your search." : "You haven't added any templates yet."}
            </div>
          ) : null}

          <div ref={sentinelRef} aria-hidden="true" className="h-1" />
          {loading ? (
            <div className="flex items-center justify-center py-6 text-black/30">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
