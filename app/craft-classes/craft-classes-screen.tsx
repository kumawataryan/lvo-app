"use client";

import { Play, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BottomNav, TemplateTopBar, tabRoute } from "@/components/craft-app";
import type { CraftClassVideo } from "@/lib/craft-classes";

export function CraftClassesScreen({ classes }: { classes: CraftClassVideo[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleClasses = normalizedQuery
    ? classes.filter((video) =>
        [video.title, ...(video.playlist?.videos.map((item) => item.title) ?? [])]
          .some((title) => title.toLowerCase().includes(normalizedQuery)),
      )
    : classes;

  return (
    <main className="fixed inset-0 bg-[var(--background)] text-black">
      <div className="relative mx-auto flex h-dvh w-full flex-col overflow-hidden bg-white">
        <TemplateTopBar
          activeCategory=""
          onCategoryChange={() => undefined}
          categoriesOverride={[]}
          activeTab="browse"
          onTabChange={(tab) => router.push(tabRoute(tab))}
        />

        <div className="shrink-0 px-4 pb-1 pt-2 md:px-5 lg:px-6">
          <label className="flex h-12 max-w-md items-center gap-2.5 rounded-2xl bg-[#f2f2f2] px-4">
            <Search className="h-4.5 w-4.5 shrink-0 text-black/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search craft classes"
              aria-label="Search craft classes"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/40"
            />
            {query ? (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/40 transition active:scale-90">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-32 pt-3 md:px-5 lg:px-6">
          {visibleClasses.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleClasses.map((video) => {
                return (
                  <Link
                    key={video.id}
                    href={`/craft-classes/${video.id}`}
                    aria-label={`Watch ${video.title}`}
                    className={`group relative block aspect-video min-w-0 rounded-[18px] bg-[#202020] text-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition active:scale-[0.98] ${video.playlist ? "mt-2 before:absolute before:-top-2 before:left-5 before:right-5 before:h-4 before:rounded-t-[14px] before:bg-black/15 after:absolute after:-top-1 after:left-2.5 after:right-2.5 after:h-4 after:rounded-t-[16px] after:bg-black/30" : "overflow-hidden"}`}
                  >
                    <span className="absolute inset-0 z-10 block overflow-hidden rounded-[18px]">
                      <Image
                        src={`https://i.ytimg.com/vi/${new URL(video.youtubeUrl).searchParams.get("v")}/hqdefault.jpg`}
                        alt={video.title}
                        fill
                        sizes="(max-width: 430px) calc(100vw - 32px), (max-width: 1024px) 45vw, 320px"
                        className="object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                      <span className="absolute right-2.5 top-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-[0_3px_12px_rgba(0,0,0,0.16)]">
                        <Play className="ml-0.5 h-4.5 w-4.5" fill="currentColor" />
                      </span>
                    </span>
                    <span className="absolute inset-x-3 bottom-3 z-20 block text-[15px] font-semibold leading-snug text-white">{video.title}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
              <p className="text-sm font-semibold">No classes yet</p>
              <p className="mt-1 text-sm text-black/40">{query ? "Try another search." : "Check back soon."}</p>
            </div>
          )}
        </section>

        <BottomNav
          active="browse"
          onChange={(tab) => router.push(tabRoute(tab))}
        />
      </div>
    </main>
  );
}
