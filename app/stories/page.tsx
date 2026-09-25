"use client";

import { useRouter } from "next/navigation";

import { BottomNav, TemplateTopBar, StoriesScreen, tabRoute } from "@/components/craft-app";
import { useStoryPlayer } from "@/components/story-player";

export default function StoriesPage() {
  const router = useRouter();
  const player = useStoryPlayer();

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
        <StoriesScreen onOpenStory={(story) => {
          player.openStory(story);
          router.push(`/stories/${story.id}`);
        }} />
        <BottomNav active="stories" onChange={(tab) => router.push(tabRoute(tab))} />
      </div>
    </main>
  );
}
