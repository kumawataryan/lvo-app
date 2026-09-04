import { CraftClassesScreen } from "./craft-classes-screen";
import { listPublishedCraftClasses } from "@/lib/craft-classes/repository";

export const dynamic = "force-dynamic";

export default async function CraftClassesPage() {
  const classes = await listPublishedCraftClasses().catch(() => []);
  return <CraftClassesScreen classes={classes} />;
}
