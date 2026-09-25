"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { BottomNav, TemplateTopBar, tabRoute } from "@/components/craft-app";

import type { Game } from "@/lib/games";

export function GamesScreen({ games }: { games: Game[] }) {
  const router = useRouter();

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
        <div className="min-h-0 flex-1 overflow-y-auto pb-44 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-2 gap-2 px-2 pb-2 pt-5 sm:grid-cols-3 md:grid-cols-4 md:gap-3 md:px-3 lg:grid-cols-5 lg:gap-4 lg:px-4 xl:grid-cols-6 2xl:grid-cols-8">
            {games.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`} className="group min-w-0 text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
                <div className="relative aspect-[3/4] overflow-hidden rounded-[18px] bg-[#202020] transition duration-200 group-hover:shadow-lg group-active:scale-[0.98] motion-reduce:transition-none">
                  {game.featuredImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={game.featuredImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute inset-x-3 bottom-3 flex h-11 items-center justify-center rounded-full bg-white text-sm font-bold text-[#202020] shadow-md transition group-hover:bg-[#f2f2f2]">
                    Play
                  </span>
                </div>
                <h2 className="mt-2 line-clamp-2 text-balance px-1 text-sm font-semibold leading-snug tracking-tight">{game.title}</h2>
              </Link>
            ))}
          </div>
        </div>
        <BottomNav active="browse" onChange={(tab) => router.push(tabRoute(tab))} />
      </div>
    </main>
  );
}
