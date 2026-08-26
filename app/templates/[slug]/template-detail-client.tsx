"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TemplateDetail, mapPublishedTemplate, useTemplateInteractions, type Template } from "@/components/craft-app";
import { fetchPublishedTemplates } from "@/lib/templates/client";

export function TemplateDetailClient({ subscribed }: { subscribed: boolean }) {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const interactions = useTemplateInteractions();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublishedTemplates(controller.signal)
      .then((items) => setTemplates(items.map(mapPublishedTemplate)))
      .catch((requestError: unknown) => {
        if ((requestError as { name?: string }).name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, []);

  if (!templates && !error) {
    return <main className="min-h-dvh bg-black" aria-label="Loading template" />;
  }

  const template = templates?.find((item) => item.slug === params.slug);

  if (!template) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white px-6 text-center text-black">
        <div>
          <h1 className="text-2xl font-semibold">{error ? "Unable to load template" : "Template not found"}</h1>
          <button type="button" onClick={() => router.push("/")} className="mt-4 rounded-full bg-black px-5 py-3 text-sm font-medium text-white">Back to templates</button>
        </div>
      </main>
    );
  }

  return <TemplateDetail template={template} templates={templates ?? [template]} onBack={() => router.push("/")} subscribed={subscribed} interactions={interactions} />;
}
