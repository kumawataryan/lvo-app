import { notFound, redirect } from "next/navigation";

import { getPublishedTemplateBySlug } from "@/lib/templates/repository";

export const dynamic = "force-dynamic";

export default async function LegacyTemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = await getPublishedTemplateBySlug(slug).catch(() => null);
  if (!template) notFound();
  redirect(`/t/${template.id}`);
}
