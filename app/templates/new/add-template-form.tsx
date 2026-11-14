"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, FileText, Link2, LoaderCircle, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { VIDEO_LINK_ERROR, parseVideoEmbedUrl, videoEmbedPreviewSrc } from "@/lib/templates/video-embed";
import { optimizeImageToWebp } from "@/lib/templates/image-optimize";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/templates/slug";
import type { AffiliateProductOption } from "@/lib/templates/affiliate";
import type { SimilarTemplateOption } from "@/lib/templates/similar";
import { AgeRangeSelector } from "@/components/age-range-selector";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { TemplateTopBar, tabRoute } from "@/components/craft-app";
import { ImportTemplatesPanel } from "./import-templates-panel";
import { ImageReorderField, type TemplateImage } from "./image-reorder-field";
import { useAiFill, type AiWrite } from "./ai-draft-panel";
import type { AiDraftField, AiDraftSuggestion } from "@/lib/templates/ai-draft";
import { FilenameCopy, VimeoCopy } from "./vimeo-copy";

type Category = { id: string; name: string; parentId: string | null };
type UploadRecord = { path: string };

export type InitialTemplateData = {
  metaTitle: string;
  metaDescription: string;
  id: string;
  title: string;
  slug: string;
  status: string;
  description: string;
  categoryIds: string[];
  minimumAge: number;
  maximumAge: number;
  durationMinutes: number;
  difficulty: string;
  videoUrl: string;
  isFree: boolean;
  supplies: string[];
  specs: Array<{ label: string; value: string }>;
  affiliateProductIds: string[];
  similarOptions: SimilarTemplateOption[];
  tags: string[];
  printablePath: string;
  images: Array<{ path: string; url: string }>;
};

const MAX_IMAGES = 30;
const PRINTABLE_EXTENSIONS = ["pdf", "zip", "jpg", "jpeg", "png", "webp"];
const PRINTABLE_ACCEPT = "application/pdf,application/zip,application/x-zip-compressed,image/jpeg,image/png,image/webp";

function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || (file.type === "application/pdf" ? "pdf" : "bin");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function filenameFromPath(path: string) {
  return path.split("/").pop() || path;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

/** Reads a JSON body without throwing: an HTML error page or empty body becomes a readable error instead of "Unexpected token <". */
async function readJsonResponse<T extends object>(response: Response): Promise<T & { error?: string }> {
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  return payload ?? ({ error: `The server returned an unexpected response (${response.status}).` } as T & { error?: string });
}

/** Browser network failures (TypeError: "Failed to fetch") are retried a couple of times; HTTP errors are returned as-is. */
async function withNetworkRetry<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (!(error instanceof TypeError) || attempt >= attempts) throw toUploadError(error);
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
}

function toUploadError(error: unknown) {
  if (error instanceof TypeError) return new Error("The connection dropped while uploading. Check your internet connection and try again.");
  return error instanceof Error ? error : new Error("Upload failed. Please try again.");
}

export function AddTemplateForm({ categories, subscribed = false, initialData, affiliateOptions = [] }: { categories: Category[]; subscribed?: boolean; initialData?: InitialTemplateData; affiliateOptions?: AffiliateProductOption[] }) {
  const router = useRouter();
  const editing = Boolean(initialData);
  const [mode, setMode] = useState<"single" | "import">("single");
  const [title, setTitle] = useState(initialData?.title ?? "");
  // New templates follow the title until the author edits the slug by hand; existing slugs are kept as-is.
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialData));
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [metaTitle, setMetaTitle] = useState(initialData?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initialData?.metaDescription ?? "");
  const [seoOpen, setSeoOpen] = useState(Boolean(initialData?.metaTitle || initialData?.metaDescription));
  const [categoryIds, setCategoryIds] = useState<string[]>(initialData?.categoryIds ?? []);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState(categories.find((category) => !category.parentId)?.id ?? "");
  const [minimumAge, setMinimumAge] = useState(String(initialData?.minimumAge ?? 4));
  const [maximumAge, setMaximumAge] = useState(String(initialData?.maximumAge ?? 8));
  const [duration, setDuration] = useState(String(initialData?.durationMinutes ?? 15));
  const [difficulty, setDifficulty] = useState(initialData?.difficulty ?? "easy");
  const [supplies, setSupplies] = useState(initialData?.supplies.join(", ") ?? "");
  const [specs, setSpecs] = useState<Array<{ id: string; label: string; value: string }>>(
    () => initialData?.specs.map((spec) => ({ id: crypto.randomUUID(), label: spec.label, value: spec.value })) ?? [],
  );
  const [affiliateIds, setAffiliateIds] = useState<string[]>(initialData?.affiliateProductIds ?? []);
  const [similarSelected, setSimilarSelected] = useState<SimilarTemplateOption[]>(initialData?.similarOptions ?? []);
  const [similarResults, setSimilarResults] = useState<SimilarTemplateOption[]>([]);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarQuery, setSimilarQuery] = useState("");
  useEffect(() => {
    if (!similarOpen) return;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({ q: similarQuery, exclude: initialData?.id ?? "" });
      fetch(`/api/templates/similar-search?${params}`)
        .then((response) => (response.ok ? response.json() : { options: [] }))
        .then((data: { options?: SimilarTemplateOption[] }) => setSimilarResults(data.options ?? []))
        .catch(() => setSimilarResults([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [similarOpen, similarQuery, initialData?.id]);
  const [affiliateOpen, setAffiliateOpen] = useState(false);
  const [affiliateQuery, setAffiliateQuery] = useState("");
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl ?? "");
  const [printable, setPrintable] = useState<File | null>(null);
  const [existingPrintablePath] = useState(initialData?.printablePath ?? "");
  const [isFree, setIsFree] = useState(initialData?.isFree ?? false);
  const [images, setImages] = useState<TemplateImage[]>(
    () => initialData?.images.map((image) => ({ id: crypto.randomUUID(), kind: "existing" as const, path: image.path, url: image.url })) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const selectPrintable = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && !PRINTABLE_EXTENSIONS.includes(fileExtension(file))) {
      setError("Printable must be a PDF, ZIP, JPG, PNG, or WebP file.");
      event.target.value = "";
      return;
    }
    if (file && file.size > 150 * 1024 * 1024) {
      setError("Printable must be smaller than 150 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setPrintable(file);
  };

  const videoLinkEmbed = parseVideoEmbedUrl(videoUrl);
  const videoReady = Boolean(videoLinkEmbed);
  const mediaReady = videoReady || Boolean(images.length);
  const ageRangeValid = Number.isInteger(Number(minimumAge))
    && Number.isInteger(Number(maximumAge))
    && Number(minimumAge) >= 0
    && Number(maximumAge) <= 16
    && Number(minimumAge) <= Number(maximumAge);
  const rootCategories = categories.filter((category) => !category.parentId);

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) => current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId]);
  };

  const addTags = (value: string) => {
    const candidates = value
      .split(",")
      .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40))
      .filter(Boolean);
    if (!candidates.length) return;
    setTags((current) => [...new Set([...current, ...candidates])].slice(0, 20));
    setTagInput("");
  };

  const hasPrintable = Boolean(printable) || Boolean(existingPrintablePath);

  // Writes AI suggestions into the form. onlyEmpty (auto-draft) never overwrites what the author already typed.
  // The AI agent writes one field at a time, so the form shows which field is being filled.
  const [aiField, setAiField] = useState<AiDraftField | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiDraftSuggestion | null>(null);
  const writeAi = (update: AiWrite) => {
    if (update.description !== undefined) setDescription(update.description);
    if (update.metaTitle !== undefined) setMetaTitle(update.metaTitle);
    if (update.metaDescription !== undefined) setMetaDescription(update.metaDescription);
    // Open the SEO section while the AI writes into it, so the author sees the text arrive.
    if (update.field === "meta") setSeoOpen(true);
    if (update.supplies !== undefined) setSupplies(update.supplies);
    if (update.tags !== undefined) setTags(update.tags);
    if (update.durationMinutes !== undefined) setDuration(String(update.durationMinutes));
    if (update.difficulty !== undefined) setDifficulty(update.difficulty);
    setAiField(update.field);
  };

  const ai = useAiFill({
    context: {
      title,
      categoryNames: categories.filter((category) => categoryIds.includes(category.id)).map((category) => category.name),
      minimumAge: Number(minimumAge),
      maximumAge: Number(maximumAge),
      difficulty: difficulty as "easy" | "medium" | "advanced",
      durationMinutes: Number(duration) || 15,
    },
    images,
    onWrite: writeAi,
    onPickTitle: (next) => { setTitle(next); if (!slugTouched) setSlug(slugify(next)); setError(""); },
    onSuggestion: setAiSuggestion,
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mediaReady || !hasPrintable || !title.trim() || !categoryIds.length || !ageRangeValid) return;
    // Whichever button was pressed decides the status: "Save as draft" (value="draft") or publish.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const asDraft = submitter?.value === "draft";

    setSubmitting(true);
    setError("");
    setStatus(editing ? "Saving changes…" : "Uploading files…");
    const uploadGroup = crypto.randomUUID();
    const uploadedToDropbox: UploadRecord[] = [];
    const uploadedToSupabase: UploadRecord[] = [];

    const uploadToDropbox = async (file: File) => {
      const linkResult = await withNetworkRetry(async () => {
        const response = await fetch("/api/dropbox/upload-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadGroup, folder: "printable", extension: fileExtension(file) }),
        });
        const result = await readJsonResponse<{ path?: string; uploadUrl?: string }>(response);
        if (!response.ok || !result.path || !result.uploadUrl) throw new Error(result.error || "Could not prepare file upload.");
        return result as { path: string; uploadUrl: string };
      });

      const uploadResponse = await withNetworkRetry(() => fetch(linkResult.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      }));
      if (!uploadResponse.ok) throw new Error(`Printable upload failed (${uploadResponse.status}). Please try again.`);
      const path = linkResult.path;
      uploadedToDropbox.push({ path });
      return path;
    };

    const uploadToSupabase = async (folder: "gallery" | "thumbnail", file: File, index?: number) => {
      const optimizedFile = await optimizeImageToWebp(file);
      const linkResult = await withNetworkRetry(async () => {
        const response = await fetch("/api/templates/media-upload-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadGroup, folder, extension: fileExtension(optimizedFile), name: optimizedFile.name, index }),
        });
        const result = await readJsonResponse<{ path?: string; token?: string }>(response);
        if (!response.ok || !result.path || !result.token) throw new Error(result.error || "Could not prepare file upload.");
        return result as { path: string; token: string };
      });

      const supabase = createSupabaseBrowserClient();
      await withNetworkRetry(async () => {
        const { error: uploadError } = await supabase.storage.from("template-media").uploadToSignedUrl(linkResult.path, linkResult.token, optimizedFile);
        // The SDK reports network failures as storage errors, so surface them as TypeErrors to get the same retry.
        if (uploadError && /fetch|network|load failed/i.test(uploadError.message)) throw new TypeError(uploadError.message);
        if (uploadError) throw new Error(uploadError.message || "Image upload failed.");
      });
      const path = linkResult.path;
      uploadedToSupabase.push({ path });
      return path;
    };

    try {
      const [printablePath, mediaPaths] = await Promise.all([
        printable ? uploadToDropbox(printable) : Promise.resolve(existingPrintablePath),
        // Featured image first, then the rest through a small pool so uploads don't fight for bandwidth/CPU.
        mapWithConcurrency(images, 6, (image, index) => (image.kind === "new"
          ? uploadToSupabase(index === 0 ? "thumbnail" : "gallery", image.file, index === 0 ? undefined : index - 1)
          : Promise.resolve(image.path))),
      ]);
      const [thumbnailPath = "", ...galleryPaths] = mediaPaths;

      setStatus(asDraft ? "Saving draft…" : editing ? "Saving…" : "Publishing template…");
      const response = await fetch(editing ? `/api/templates/mine/${initialData!.id}` : "/api/templates/create", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          status: asDraft ? "draft" : "published",
          description: description.trim(),
          metaTitle: metaTitle.trim(),
          metaDescription: metaDescription.trim(),
          categoryIds,
          minimumAge: Number(minimumAge),
          maximumAge: Number(maximumAge),
          durationMinutes: Number(duration),
          difficulty,
          videoUrl: videoUrl.trim(),
          thumbnailPath,
          printablePath,
          isFree,
          galleryPaths,
          supplies: supplies.split(",").map((item) => item.trim()).filter(Boolean),
          specs: specs.map(({ label, value }) => ({ label: label.trim(), value: value.trim() })).filter((spec) => spec.label && spec.value),
          affiliateProductIds: affiliateIds,
          similarTemplateIds: similarSelected.map((option) => option.id),
          tags: [...tags, ...tagInput.split(",").map((item) => item.trim()).filter(Boolean)],
        }),
      });
      const result = await readJsonResponse<{ id?: string; slug?: string }>(response);
      if (!response.ok || !result.id) throw new Error(result.error || (editing ? "Could not save changes." : "Could not publish this template."));

      if (editing && initialData) {
        const keptImagePaths = new Set(images.filter((image) => image.kind === "existing").map((image) => image.path));
        const removedImagePaths = initialData.images.map((image) => image.path).filter((path) => !keptImagePaths.has(path));
        if (printable && existingPrintablePath) removedImagePaths.push(existingPrintablePath);

        const staleDropboxPaths = removedImagePaths.filter((path) => path.startsWith("/lvo-files/"));
        const staleSupabasePaths = removedImagePaths.filter((path) => !path.startsWith("/lvo-files/"));
        void Promise.all([
          staleDropboxPaths.length
            ? fetch("/api/dropbox/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: staleDropboxPaths }) }).catch(() => undefined)
            : null,
          staleSupabasePaths.length
            ? fetch("/api/templates/media-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: staleSupabasePaths }) }).catch(() => undefined)
            : null,
        ]);
      }

      setStatus(asDraft ? "Draft saved" : editing ? "Saved" : "Published");
      // replace() already renders the destination fresh; a separate refresh() would re-render everything a second time.
      // Drafts are hidden from the site, so they go back to the manage list instead of their public page.
      router.replace(asDraft || editing ? "/templates/manage" : `/t/${result.slug ?? result.id}`);
    } catch (caughtError) {
      if (uploadedToDropbox.length) {
        await fetch("/api/dropbox/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: uploadedToDropbox.map(({ path }) => path) }),
        }).catch(() => undefined);
      }
      if (uploadedToSupabase.length) {
        await fetch("/api/templates/media-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: uploadedToSupabase.map(({ path }) => path) }),
        }).catch(() => undefined);
      }
      setError(toUploadError(caughtError).message);
      setStatus("");
      setSubmitting(false);
    }
  };

  const deleteTemplate = async () => {
    if (!initialData) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/templates/mine/${initialData.id}`, { method: "DELETE" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not delete this template.");
      router.replace("/templates/manage");
      router.refresh();
    } catch (caughtError) {
      setDeleteError(caughtError instanceof Error ? caughtError.message : "Could not delete this template.");
      setDeleting(false);
    }
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white text-black">
      <TemplateTopBar canAddTemplates={false} subscribed={subscribed} activeCategory="" onCategoryChange={() => undefined} categoriesOverride={[]} onTabChange={(tab) => router.push(tabRoute(tab))} alwaysShowNav />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight">{editing ? "Edit template" : "New template"}</p>
          {editing ? (
            <button type="button" aria-label="Delete template" onClick={() => { setDeleteError(""); setDeleteOpen(true); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition active:scale-95"><Trash2 className="h-4 w-4" /></button>
          ) : null}
        </div>

        {editing ? null : (
        <div className="mt-4 inline-flex w-fit gap-1 rounded-xl bg-[#f2f2f2] p-1">
          <button type="button" onClick={() => setMode("single")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === "single" ? "bg-white shadow-sm" : "text-black/50"}`}>Add one</button>
          <button type="button" onClick={() => setMode("import")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === "import" ? "bg-white shadow-sm" : "text-black/50"}`}>Import CSV</button>
        </div>
        )}

        {!editing && mode === "import" ? <ImportTemplatesPanel categories={categories} /> : (
        <form onSubmit={submit} className="contents">
        <div className="mt-7 space-y-8">
          <Field label="Video" optional={Boolean(images.length)}>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <div className="relative">
                  <Link2 aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" strokeWidth={2.25} />
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(event) => { setVideoUrl(event.target.value); setError(""); }}
                    placeholder="YouTube or Vimeo link"
                    className="h-12 w-full rounded-xl bg-[#f2f2f2] pl-11 pr-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2"
                  />
                </div>
                <p className="mt-1.5 text-xs text-black/35">
                  {videoUrl && !videoLinkEmbed
                    ? VIDEO_LINK_ERROR
                    : images.length
                      ? "Optional · youtube.com/shorts/…, youtu.be/… or vimeo.com/…"
                      : "youtube.com/shorts/…, youtu.be/… or vimeo.com/…"}
                </p>
              </div>
              {videoLinkEmbed ? (
                <div className="aspect-9/16 w-19 shrink-0 overflow-hidden rounded-xl bg-black">
                  <iframe
                    key={`${videoLinkEmbed.provider}-${videoLinkEmbed.id}`}
                    src={videoEmbedPreviewSrc(videoLinkEmbed)}
                    title="Video preview"
                    className="h-full w-full border-0"
                    allow="autoplay; encrypted-media"
                  />
                </div>
              ) : null}
            </div>
          </Field>

          {aiSuggestion ? <VimeoCopy suggestion={aiSuggestion} title={title} slug={slug} /> : null}

          <div className="block">
            <div className="mb-2 flex h-8 items-center justify-between gap-3">
              <span className="text-sm font-medium">Title</span>
              {ai.trigger}
            </div>
            <input required maxLength={120} autoFocus value={title} onChange={(event) => { setTitle(event.target.value); if (!slugTouched) setSlug(slugify(event.target.value)); }} placeholder="Paper flower bouquet" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
            {ai.results}
          </div>


          <Field label="Slug" optional>
            <input
              value={slug}
              maxLength={90}
              onChange={(event) => { setSlug(event.target.value); setSlugTouched(true); setError(""); }}
              onBlur={() => setSlug((current) => slugify(current))}
              placeholder="paper-flower-bouquet"
              className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 font-mono text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2"
            />
            {slugTouched && slug !== slugify(title) ? (
              <div className="mt-1.5 flex justify-end text-xs text-black/35">
                <button type="button" onClick={() => { setSlug(slugify(title)); setSlugTouched(false); }} className="shrink-0 font-semibold text-black/55 underline-offset-2 hover:underline">Reset</button>
              </div>
            ) : null}
          </Field>

          <Field label="Description" optional aiActive={aiField === "description"}>
            <textarea maxLength={400} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A simple activity with clear steps." className="w-full resize-none rounded-xl bg-[#f2f2f2] px-4 py-3 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
          </Field>

          <Field label="Categories">
            <button type="button" onClick={() => setCategoryPickerOpen(true)} className="flex h-12 w-full items-center rounded-xl bg-[#f2f2f2] px-4 text-left transition active:scale-[0.99]">
              <span className={`min-w-0 flex-1 truncate text-sm ${categoryIds.length ? "font-medium text-black" : "text-black/35"}`}>
                {categoryIds.length ? `${categoryIds.length} selected` : "Choose categories"}
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 text-black/40" />
            </button>
            {categoryIds.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categoryIds.map((id) => {
                  const category = categories.find((item) => item.id === id);
                  return category ? (
                    <button key={id} type="button" onClick={() => toggleCategory(id)} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white">
                      {category.name}<X aria-hidden="true" className="h-3 w-3 text-white/65" />
                    </button>
                  ) : null;
                })}
              </div>
            ) : null}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Age range">
              <AgeRangeSelector
                minimumAge={Number(minimumAge)}
                maximumAge={Number(maximumAge)}
                onChange={(minimum, maximum) => { setMinimumAge(String(minimum ?? 0)); setMaximumAge(String(maximum ?? 16)); }}
              />
            </Field>

            <Field label="Access">
              <button type="button" role="switch" aria-checked={isFree} onClick={() => setIsFree((value) => !value)} className="flex h-12 w-full items-center justify-between rounded-xl bg-[#f2f2f2] px-4 text-sm font-medium">
                <span>Free download</span>
                <span className={`relative h-6 w-11 rounded-full transition ${isFree ? "bg-brand" : "bg-black/15"}`}>
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${isFree ? "left-6" : "left-1"}`} />
                </span>
              </button>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Time in minutes" aiActive={aiField === "time"}>
              <input required type="number" min={1} max={1440} inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition focus:ring-2" />
            </Field>
            <Field label="Difficulty" aiActive={aiField === "time"}>
              <div className="relative">
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="h-12 w-full appearance-none rounded-xl bg-[#f2f2f2] py-0 pl-4 pr-10 text-sm outline-none ring-black/10 transition focus:ring-2">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="advanced">Advanced</option>
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" strokeWidth={2.25} />
              </div>
            </Field>
          </div>

          <Field label="Supplies (comma separated)" optional aiActive={aiField === "supplies"}>
            <input value={supplies} onChange={(event) => setSupplies(event.target.value)} placeholder="Paper, scissors, glue" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
          </Field>

          <Field label="Affiliate products" optional>
            {affiliateOptions.length ? (() => {
              const query = affiliateQuery.trim().toLowerCase();
              const visible = affiliateOptions.filter((option) => !query || option.shortName.toLowerCase().includes(query) || option.name.toLowerCase().includes(query));
              const selectedNames = affiliateOptions.filter((option) => affiliateIds.includes(option.id)).map((option) => option.shortName);
              return (
                <div className="relative">
                  <button type="button" aria-expanded={affiliateOpen} onClick={() => setAffiliateOpen((open) => !open)} className="flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-[#f2f2f2] px-4 text-left text-sm outline-none ring-black/10 transition focus:ring-2">
                    <span className={`min-w-0 truncate ${selectedNames.length ? "text-black" : "text-black/35"}`}>{selectedNames.length ? selectedNames.join(", ") : "Select products"}</span>
                    <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-black/60 transition ${affiliateOpen ? "rotate-180" : ""}`} strokeWidth={2.25} />
                  </button>
                  {affiliateOpen ? (
                    <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/10">
                      <div className="flex h-10 items-center gap-2 rounded-lg bg-[#f2f2f2] px-3">
                        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-black/40" />
                        <input autoFocus value={affiliateQuery} onChange={(event) => setAffiliateQuery(event.target.value)} placeholder="Search products" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/35" />
                      </div>
                      <ul className="mt-2 max-h-64 overflow-y-auto">
                        {visible.length ? visible.map((option) => {
                          const selected = affiliateIds.includes(option.id);
                          return (
                            <li key={option.id}>
                              <button type="button" role="option" aria-selected={selected} onClick={() => setAffiliateIds((current) => (selected ? current.filter((id) => id !== option.id) : [...current, option.id]))} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-[#f2f2f2]">
                                {option.imageUrl ? <img src={option.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded bg-white object-contain" /> : null}
                                <span className="min-w-0 flex-1 truncate">{option.shortName}<span className="text-black/45"> · {option.name}</span></span>
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-brand bg-brand text-white" : "border-black/20"}`}>{selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
                              </button>
                            </li>
                          );
                        }) : <li className="px-2 py-3 text-sm text-black/45">No products match.</li>}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })() : (
              <p className="text-sm text-black/50">No affiliate products are available yet.</p>
            )}
          </Field>

          <Field label="Similar templates" optional>
            <div className="relative">
              <button type="button" aria-expanded={similarOpen} onClick={() => setSimilarOpen((open) => !open)} className="flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-[#f2f2f2] px-4 text-left text-sm outline-none ring-black/10 transition focus:ring-2">
                <span className={`min-w-0 truncate ${similarSelected.length ? "text-black" : "text-black/35"}`}>{similarSelected.length ? similarSelected.map((option) => option.title).join(", ") : "Search any template"}</span>
                <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-black/60 transition ${similarOpen ? "rotate-180" : ""}`} strokeWidth={2.25} />
              </button>
              {similarOpen ? (
                <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/10">
                  <div className="flex h-10 items-center gap-2 rounded-lg bg-[#f2f2f2] px-3">
                    <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-black/40" />
                    <input autoFocus value={similarQuery} onChange={(event) => setSimilarQuery(event.target.value)} placeholder="Search all templates" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/35" />
                  </div>
                  <ul className="mt-2 max-h-64 overflow-y-auto">
                    {similarResults.length ? similarResults.map((option) => {
                      const selected = similarSelected.some((item) => item.id === option.id);
                      return (
                        <li key={option.id}>
                          <button type="button" role="option" aria-selected={selected} onClick={() => setSimilarSelected((current) => (selected ? current.filter((item) => item.id !== option.id) : [...current, option]))} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-[#f2f2f2]">
                            {option.imageUrl ? <img src={option.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded bg-white object-cover" /> : null}
                            <span className="min-w-0 flex-1 truncate">{option.title}</span>
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-brand bg-brand text-white" : "border-black/20"}`}>{selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
                          </button>
                        </li>
                      );
                    }) : <li className="px-2 py-3 text-sm text-black/45">No templates match.</li>}
                  </ul>
                </div>
              ) : null}
            </div>
          </Field>

          <Field label="Details (label and value)" optional>
            <div className="space-y-2">
              {specs.map((spec) => (
                <div key={spec.id} className="flex items-center gap-2">
                  <input
                    value={spec.label}
                    onChange={(event) => setSpecs((current) => current.map((item) => (item.id === spec.id ? { ...item, label: event.target.value } : item)))}
                    placeholder="Label, e.g. Resolution"
                    maxLength={60}
                    aria-label="Spec label"
                    className="h-12 min-w-0 flex-1 rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2"
                  />
                  <input
                    value={spec.value}
                    onChange={(event) => setSpecs((current) => current.map((item) => (item.id === spec.id ? { ...item, value: event.target.value } : item)))}
                    placeholder="Value, e.g. 300 DPI"
                    maxLength={200}
                    aria-label="Spec value"
                    className="h-12 min-w-0 flex-1 rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2"
                  />
                  <button
                    type="button"
                    aria-label="Remove spec"
                    onClick={() => setSpecs((current) => current.filter((item) => item.id !== spec.id))}
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl text-black/50 transition hover:bg-[#f2f2f2] hover:text-black"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {specs.length < 12 ? (
                <button
                  type="button"
                  onClick={() => setSpecs((current) => [...current, { id: crypto.randomUUID(), label: "", value: "" }])}
                  className="h-10 rounded-xl border border-dashed border-black/20 px-4 text-sm font-medium text-black/70 transition hover:bg-[#f2f2f2]"
                >
                  Add detail
                </button>
              ) : null}
            </div>
          </Field>

          <Field label="Tags" optional aiActive={aiField === "tags"}>
            <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl bg-[#f2f2f2] px-3 py-2 ring-black/10 transition focus-within:ring-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-2.5 text-xs font-medium text-white">
                  {tag}
                  <button type="button" aria-label={`Remove ${tag} tag`} onClick={() => setTags((current) => current.filter((item) => item !== tag))} className="flex h-5 w-5 items-center justify-center rounded text-white/65 transition hover:text-white">
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                disabled={tags.length >= 20}
                maxLength={40}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.endsWith(",")) addTags(value);
                  else setTagInput(value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTags(tagInput);
                  } else if (event.key === "Backspace" && !tagInput && tags.length) {
                    setTags((current) => current.slice(0, -1));
                  }
                }}
                onPaste={(event) => {
                  const value = event.clipboardData.getData("text");
                  if (!value.includes(",")) return;
                  event.preventDefault();
                  addTags(value);
                }}
                onBlur={() => addTags(tagInput)}
                placeholder={tags.length ? "Add another…" : "Type a tag and press Enter"}
                aria-label="Add a search tag"
                className="h-8 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-black/35 disabled:hidden"
              />
            </div>
            {tags.length ? <p className="mt-1.5 text-right text-xs text-black/35">{tags.length}/20</p> : null}
          </Field>

          <Field label="Images" optional={videoReady}>
            <ImageReorderField images={images} onChange={setImages} onError={setError} maxImages={MAX_IMAGES} />
          </Field>
          {aiSuggestion ? <FilenameCopy names={aiSuggestion.filenameIdeas} /> : null}

          <Field label="Printable">
            <FilePicker
              required={!editing}
              icon={<FileText className="h-5 w-5" />}
              title={printable?.name ?? (existingPrintablePath ? filenameFromPath(existingPrintablePath) : "Printable file")}
              detail={printable ? `${formatFileSize(printable.size)} · Ready to upload` : existingPrintablePath ? "Already uploaded" : "Required · PDF, ZIP, JPG, PNG, or WebP · up to 150 MB"}
              selected={hasPrintable}
              accept={PRINTABLE_ACCEPT}
              onChange={selectPrintable}
            />
          </Field>
        </div>

        <div className="mt-6">
          <button type="button" aria-expanded={seoOpen} onClick={() => setSeoOpen((open) => !open)} className="flex h-12 w-full items-center justify-between rounded-xl bg-[#f2f2f2] px-4 text-left text-sm font-medium transition active:scale-[0.99]">
            <span>More options · SEO</span>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 text-black/60 transition ${seoOpen ? "rotate-180" : ""}`} strokeWidth={2.25} />
          </button>
          {seoOpen ? (
            <div className="mt-5 space-y-8">
              <Field label="Meta title" optional aiActive={aiField === "meta"}>
                <input maxLength={70} value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} placeholder={title || "Paper flower bouquet"} className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
                <span className="mt-1.5 block text-right text-[11px] tabular-nums text-black/35">{metaTitle.length}/70</span>
              </Field>
              <Field label="Meta description" optional aiActive={aiField === "meta"}>
                <textarea maxLength={180} rows={3} value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} placeholder="What a parent will make, and what they need." className="w-full resize-none rounded-xl bg-[#f2f2f2] px-4 py-3 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
                <span className="mt-1.5 block text-right text-[11px] tabular-nums text-black/35">{metaDescription.length}/180</span>
              </Field>
              <p className="text-xs text-black/40">Shown in search results and link previews. Leave empty to use the title and short description.</p>
            </div>
          ) : null}
        </div>

        {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-7 flex gap-3">
          <button type="submit" value="draft" disabled={submitting || !mediaReady || !hasPrintable || !title.trim() || !categoryIds.length || !ageRangeValid} className="flex h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] text-sm font-semibold text-black transition active:scale-[0.99] disabled:text-black/30">
            Save as draft
          </button>
          <button type="submit" value="published" disabled={submitting || !mediaReady || !hasPrintable || !title.trim() || !categoryIds.length || !ageRangeValid} className="flex h-13 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
            {submitting ? <><LoaderCircle className="h-5 w-5 animate-spin" />{status}</> : editing && initialData?.status !== "draft" ? <><Check className="h-4 w-4" />Save changes</> : <><Plus className="h-4 w-4" />Publish template</>}
          </button>
        </div>
        </form>
        )}
      </div>
      </div>
      <Drawer open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
        <DrawerContent>
          <DrawerTitle className="text-lg font-semibold tracking-tight">Categories</DrawerTitle>
          <DrawerDescription className="sr-only">Choose one or more categories for this template.</DrawerDescription>
          <div className="mt-4 max-h-[60dvh] space-y-2 overflow-y-auto">
            {rootCategories.map((root) => {
              const children = categories.filter((category) => category.parentId === root.id);
              const options = children.length ? children : [root];
              const selectedCount = options.filter((category) => categoryIds.includes(category.id)).length;
              const open = openCategoryId === root.id;
              return (
                <div key={root.id} className="rounded-2xl bg-[#f2f2f2]">
                  <button type="button" aria-expanded={open} onClick={() => setOpenCategoryId(open ? "" : root.id)} className="flex h-12 w-full items-center px-4 text-left">
                    <span className="min-w-0 flex-1 text-sm font-semibold">{root.name}</span>
                    {selectedCount ? <span className="mr-2 text-xs font-medium text-black/45">{selectedCount}</span> : null}
                    <ChevronDown aria-hidden="true" className={`h-4 w-4 text-black/35 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open ? (
                    <div className="flex flex-wrap gap-2 px-3 pb-3">
                      {options.map((category) => {
                        const selected = categoryIds.includes(category.id);
                        return (
                          <button key={category.id} type="button" aria-pressed={selected} onClick={() => toggleCategory(category.id)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ${selected ? "bg-brand text-white" : "bg-white text-black/55"}`}>
                            {selected ? <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
                            {category.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setCategoryPickerOpen(false)} disabled={!categoryIds.length} className="mt-5 h-12 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:bg-black/20">Done</button>
        </DrawerContent>
      </Drawer>

      {deleteOpen ? (
        <Drawer open onOpenChange={(open) => { if (!open && !deleting) setDeleteOpen(false); }}>
          <DrawerContent>
            <div aria-hidden="true" className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-black/15" />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><Trash2 className="h-5 w-5" /></div>
            <DrawerTitle className="mt-5 text-xl font-semibold tracking-tight">Delete template?</DrawerTitle>
            <DrawerDescription className="mt-2 text-sm leading-6 text-black/50">&ldquo;{title}&rdquo; and its files will be permanently removed. This can&apos;t be undone.</DrawerDescription>
            {deleteError ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</p> : null}
            <button type="button" disabled={deleting} onClick={() => void deleteTemplate()} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-50">{deleting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Deleting…</> : "Delete"}</button>
            <button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)} className="mt-2 h-12 w-full rounded-xl bg-[#f2f2f2] text-sm font-semibold text-black disabled:opacity-50">Cancel</button>
          </DrawerContent>
        </Drawer>
      ) : null}
    </main>
  );
}

function Field({ label, optional = false, aiActive = false, children }: { label: string; optional?: boolean; aiActive?: boolean; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 flex h-5 items-center gap-1.5 text-sm font-medium">
        {label}{optional ? <span className="text-xs font-normal text-black/35">Optional</span> : null}
        {aiActive ? <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-black/60 animate-in fade-in duration-200"><Sparkles aria-hidden="true" className="h-3.5 w-3.5 animate-pulse" />AI writing</span> : null}
      </span>
      {/* The glow is an overlay, so it never shifts the layout while the AI types. */}
      <div className="relative">
        {children}
        {aiActive ? <span aria-hidden="true" className="pointer-events-none absolute -inset-[3px] rounded-[14px] ring-2 ring-black/15 animate-in fade-in duration-200" /> : null}
      </div>
    </div>
  );
}

function FilePicker({ icon, title, detail, selected, accept, onChange, required = false, multiple = false, showDropboxBadge = true }: { icon: ReactNode; title: string; detail: string; selected: boolean; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; required?: boolean; multiple?: boolean; showDropboxBadge?: boolean }) {
  return (
    <label className="flex min-h-18 cursor-pointer items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-3 transition hover:border-black/20 active:scale-[0.99]">
      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#0061ff] text-white" : "bg-[#f2f2f2] text-black/55"}`}>
        {selected ? <Check className="h-5 w-5" strokeWidth={2.5} /> : icon}
        {showDropboxBadge ? (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md border-2 border-white bg-white text-[#0061ff]" aria-hidden="true">
            <DropboxMark className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-black/40">{detail}</span>
      </span>
      <span className="shrink-0 rounded-lg bg-[#f2f2f2] px-3 py-2 text-xs font-semibold text-black/70">
        {selected ? "Replace" : "Choose"}
      </span>
      <input type="file" required={required} multiple={multiple} accept={accept} onChange={onChange} className="sr-only" />
    </label>
  );
}

function DropboxMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5.9 0 0 3.75 5.9 7.5l5.9-3.75L5.9 0Zm12.2 0-5.9 3.75 5.9 3.75L24 3.75 18.1 0ZM0 11.25 5.9 15l5.9-3.75L5.9 7.5 0 11.25Zm18.1-3.75-5.9 3.75L18.1 15l5.9-3.75-5.9-3.75ZM6.1 16.25 12 20l5.9-3.75L12 12.5l-5.9 3.75Z" />
    </svg>
  );
}
