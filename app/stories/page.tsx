"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { BottomNav, StoriesScreen } from "@/components/craft-app";
import { useStoryPlayer } from "@/components/story-player";

export default function StoriesPage() {
  const router = useRouter();
  const player = useStoryPlayer();

  return (
    <main className="fixed inset-0 bg-[var(--background)] text-black">
      <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-white">
        <header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[calc(16px+env(safe-area-inset-top))]">
          <button type="button" aria-label="Back to categories" onClick={() => router.push("/?tab=browse")} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2f2f2] transition active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">Stories</h1>
        </header>
        <StoriesScreen onOpenStory={(story) => {
          player.openStory(story);
          router.push(`/stories/${story.id}`);
        }} />
        <BottomNav active="stories" onChange={(tab) => router.push(tab === "templates" ? "/" : `/?tab=${tab}`)} />
      </div>
    </main>
  );
}
