import { notFound } from "next/navigation";

import { CraftClassVideoScreen } from "./craft-class-video-screen";
import { getPublishedCraftClassBySlug } from "@/lib/craft-classes/repository";

export const dynamic = "force-dynamic";

export default async function CraftClassVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const craftClass = await getPublishedCraftClassBySlug(id).catch(() => null);
  if (!craftClass) notFound();
  return <CraftClassVideoScreen craftClass={craftClass} />;
}
