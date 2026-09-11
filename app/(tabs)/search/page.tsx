import { SearchTabContent } from "@/components/craft-app";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <SearchTabContent initialQuery={q} />;
}
