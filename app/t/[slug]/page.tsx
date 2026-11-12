import type { Metadata } from "next";
import { permanentRedirect, redirect } from "next/navigation";

import { TemplateDetailClient } from "@/app/templates/[slug]/template-detail-client";
import { getSessionUser } from "@/lib/auth/session";
import { canUserAddTemplates } from "@/lib/auth/permissions";
import { getFamilyOnboarding } from "@/lib/onboarding/server";
import { hasActiveSubscription } from "@/lib/payments/repository";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { getCachedTemplateContent, getCachedTemplateSlugById } from "@/lib/templates/cached";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SITE_NAME = "Lovely Vibes Only Craft Library";
// Set NEXT_PUBLIC_SITE_URL (e.g. https://your-domain.com) so canonical and social links are absolute.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = UUID_PATTERN.test(slug) ? null : await getCachedTemplateContent(slug);
  if (!content) return { robots: { index: false, follow: false } };

  const { template } = content;
  const title = `${template.title} | ${SITE_NAME}`;
  const description = template.shortDescription || `${template.title}: a ${template.category.name.toLowerCase()} template with clear, easy steps.`;
  const url = SITE_URL ? `${SITE_URL}/t/${template.slug}` : undefined;
  const image = template.thumbnailUrl?.startsWith("http") ? template.thumbnailUrl : undefined;

  return {
    title,
    description,
    // The root layout asks search engines not to index the site; template pages are the exception.
    robots: { index: true, follow: true },
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: SITE_NAME,
      url,
      images: image ? [image] : undefined,
    },
  };
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Old id-based links (/t/<uuid>) move permanently to the template's current slug URL.
  if (UUID_PATTERN.test(slug)) {
    const currentSlug = await getCachedTemplateSlugById(slug).catch(() => null);
    if (currentSlug) permanentRedirect(`/t/${currentSlug}`);
    redirect("/");
  }

  // Content and account checks are independent; only related content needs the template first.
  const contentPromise = getCachedTemplateContent(slug);
  const accountPromise = (async () => {
    const supabase = await createSupabaseAuthServerClient();
    const user = await getSessionUser(supabase);
    const [onboarding, subscribed] = await Promise.all([
      user ? getFamilyOnboarding(supabase, user.id).catch(() => null) : null,
      user ? hasActiveSubscription(supabase, user.id).catch(() => false) : false,
    ]);
    return { user, onboarding, subscribed };
  })();
  const [content, { user, onboarding, subscribed }] = await Promise.all([contentPromise, accountPromise]);
  // Drafted or deleted templates are no longer published, so visitors go back to the homepage.
  if (!content) redirect("/");
  if (user && !onboarding?.completed) redirect("/onboarding");
  const { template, related, categoryTrail } = content;

  return <TemplateDetailClient subscribed={subscribed} canAddTemplates={canUserAddTemplates(user)} initialTemplate={template} initialRelated={related} categoryTrail={categoryTrail} />;
}
