import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getPublishedGameBySlug, loadGameHtml } from "@/lib/games/repository";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getPublishedGameBySlug(id).catch(() => null);
  if (!game) notFound();
  const html = await loadGameHtml(game).catch(() => null);
  if (html === null) notFound();

  return (
    <main className="fixed inset-0 h-dvh overflow-hidden bg-white text-black">
      <iframe srcDoc={html} sandbox="allow-scripts allow-forms allow-popups" title={game.title} className="h-full w-full border-0" />
      <Link
        href="/games"
        aria-label="Back to games"
        className="absolute left-3 top-[calc(12px+env(safe-area-inset-top))] z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/20 text-white backdrop-blur-xl transition hover:bg-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-95 min-[900px]:left-4"
      >
        <ArrowLeft aria-hidden="true" className="h-7 w-7 min-[900px]:h-6 min-[900px]:w-6" />
      </Link>
    </main>
  );
}
