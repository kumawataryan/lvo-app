"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { TemplateDetail, mapPublishedTemplate, useTemplateInteractions } from "@/components/craft-app";
import type { PublishedTemplate } from "@/lib/templates/types";

export function TemplateDetailClient({ subscribed, initialTemplate, initialRelated }: { subscribed: boolean; initialTemplate: PublishedTemplate; initialRelated: PublishedTemplate[] }) {
  const router = useRouter();
  const interactions = useTemplateInteractions();
  const template = useMemo(() => mapPublishedTemplate(initialTemplate), [initialTemplate]);
  const related = useMemo(() => initialRelated.map(mapPublishedTemplate), [initialRelated]);

  return <TemplateDetail template={template} related={related} onBack={() => router.back()} subscribed={subscribed} interactions={interactions} />;
}
