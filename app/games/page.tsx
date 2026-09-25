import { GamesScreen } from "./games-screen";
import { listPublishedGames } from "@/lib/games/repository";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const games = await listPublishedGames().catch(() => []);
  return <GamesScreen games={games} />;
}
