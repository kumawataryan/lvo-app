"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { TemplateDetail, mapPublishedTemplate, useTemplateInteractions } from "@/components/craft-app";
import type { TemplateCategoryTrail } from "@/lib/templates/repository";
import type { PublishedTemplate } from "@/lib/templates/types";

export function TemplateDetailClient({ subscribed, canAddTemplates = false, initialTemplate, initialRelated, categoryTrail = null }: { subscribed: boolean; canAddTemplates?: boolean; initialTemplate: PublishedTemplate; initialRelated: PublishedTemplate[]; categoryTrail?: TemplateCategoryTrail | null }) {
  const router = useRouter();
  const interactions = useTemplateInteractions();
  const template = useMemo(() => mapPublishedTemplate(initialTemplate), [initialTemplate]);
  const related = useMemo(() => initialRelated.map(mapPublishedTemplate), [initialRelated]);

  return <TemplateDetail template={template} related={related} onBack={() => router.back()} subscribed={subscribed} canAddTemplates={canAddTemplates} interactions={interactions} categoryTrail={categoryTrail} />;
}
