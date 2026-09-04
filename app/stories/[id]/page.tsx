"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { BottomNav, StoriesScreen, StoryDetail, demoStories, type StoryDetailHandle } from "@/components/craft-app";
import { useStoryPlayer } from "@/components/story-player";

export default function StoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const story = demoStories.find((item) => item.id === params.id);
  const player = useStoryPlayer();
  const storyDetailRef = useRef<StoryDetailHandle | null>(null);

  useEffect(() => {
    if (story && player.story?.id !== story.id) player.openStory(story);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  if (!story) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black px-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Story not found</h1>
          <button type="button" onClick={() => router.push("/")} className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-medium text-black">Back to stories</button>
        </div>
      </main>
    );
  }

  if (!player.story || player.story.id !== story.id) return null;

  const openStory = (next: typeof story) => {
    player.openStory(next);
    router.push(`/stories/${next.id}`);
  };

  return (
    <>
      <main className="fixed inset-0 bg-[var(--background)] text-black">
        <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-white">
          <header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[calc(16px+env(safe-area-inset-top))]">
            <button type="button" aria-label="Back to categories" onClick={() => router.push("/?tab=browse")} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2f2f2] transition active:scale-95">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">Stories</h1>
          </header>
          <StoriesScreen onOpenStory={openStory} />
        </div>
      </main>

      <StoryDetail
        ref={storyDetailRef}
        story={player.story}
        progress={player.progress}
        playing={player.playing}
        onProgressChange={player.setProgress}
        onPlayingChange={player.setPlaying}
        onMinimize={() => { player.minimize(); router.push("/stories"); }}
      />
      <BottomNav
        active="stories"
        nowPlaying={{
          story: player.story,
          progress: player.progress,
          playing: player.playing,
          onOpen: () => {
            if (player.minimized) {
              player.restore();
            } else if (storyDetailRef.current) {
              storyDetailRef.current.minimize();
            } else {
              player.minimize();
              router.push("/stories");
            }
          },
          onTogglePlaying: () => player.setPlaying(!player.playing),
        }}
        onChange={(nextTab) => {
          player.setPlaying(false);
          const finish = () => { player.minimize(); router.push(`/?tab=${nextTab}`); };
          if (storyDetailRef.current) storyDetailRef.current.minimize(finish);
          else finish();
        }}
      />
    </>
  );
}
