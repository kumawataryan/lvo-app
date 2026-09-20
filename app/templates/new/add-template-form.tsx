"use client";

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, FileText, Link2, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { VIDEO_LINK_ERROR, parseVideoEmbedUrl, videoEmbedPreviewSrc } from "@/lib/templates/video-embed";
import { optimizeImageToWebp } from "@/lib/templates/image-optimize";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AgeRangeSelector } from "@/components/age-range-selector";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { TemplateTopBar, tabRoute } from "@/components/craft-app";
import { ImportTemplatesPanel } from "./import-templates-panel";
import { ImageReorderField, type TemplateImage } from "./image-reorder-field";

type Category = { id: string; name: string; parentId: string | null };
type UploadRecord = { path: string };

export type InitialTemplateData = {
  id: string;
  title: string;
  description: string;
  categoryIds: string[];
  minimumAge: number;
  maximumAge: number;
  durationMinutes: number;
  difficulty: string;
  videoUrl: string;
  isFree: boolean;
  supplies: string[];
  tags: string[];
  printablePath: string;
  images: Array<{ path: string; url: string }>;
};

const MAX_IMAGES = 10;
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

export function AddTemplateForm({ categories, subscribed = false, initialData }: { categories: Category[]; subscribed?: boolean; initialData?: InitialTemplateData }) {
  const router = useRouter();
  const editing = Boolean(initialData);
  const [mode, setMode] = useState<"single" | "import">("single");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(initialData?.categoryIds ?? []);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState(categories.find((category) => !category.parentId)?.id ?? "");
  const [minimumAge, setMinimumAge] = useState(String(initialData?.minimumAge ?? 4));
  const [maximumAge, setMaximumAge] = useState(String(initialData?.maximumAge ?? 8));
  const [duration, setDuration] = useState(String(initialData?.durationMinutes ?? 15));
  const [difficulty, setDifficulty] = useState(initialData?.difficulty ?? "easy");
  const [supplies, setSupplies] = useState(initialData?.supplies.join(", ") ?? "");
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
    if (file && file.size > 25 * 1024 * 1024) {
      setError("Printable must be smaller than 25 MB.");
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
    && Number(maximumAge) <= 18
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mediaReady || !hasPrintable || !title.trim() || !categoryIds.length || !ageRangeValid) return;

    setSubmitting(true);
    setError("");
    setStatus(editing ? "Saving changes…" : "Uploading files…");
    const uploadGroup = crypto.randomUUID();
    const uploadedToDropbox: UploadRecord[] = [];
    const uploadedToSupabase: UploadRecord[] = [];

    const uploadToDropbox = async (file: File) => {
      const linkResponse = await fetch("/api/dropbox/upload-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadGroup, folder: "printable", extension: fileExtension(file) }),
      });
      const linkResult = await linkResponse.json() as { path?: string; uploadUrl?: string; error?: string };
      if (!linkResponse.ok || !linkResult.path || !linkResult.uploadUrl) throw new Error(linkResult.error || "Could not prepare file upload.");

      const uploadResponse = await fetch(linkResult.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error(`Dropbox upload failed (${uploadResponse.status}).`);
      const path = linkResult.path;
      uploadedToDropbox.push({ path });
      return path;
    };

    const uploadToSupabase = async (folder: "gallery" | "thumbnail", file: File, index?: number) => {
      const optimizedFile = await optimizeImageToWebp(file);
      const linkResponse = await fetch("/api/templates/media-upload-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadGroup, folder, extension: fileExtension(optimizedFile), name: optimizedFile.name, index }),
      });
      const linkResult = await linkResponse.json() as { path?: string; token?: string; error?: string };
      if (!linkResponse.ok || !linkResult.path || !linkResult.token) throw new Error(linkResult.error || "Could not prepare file upload.");

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage.from("template-media").uploadToSignedUrl(linkResult.path, linkResult.token, optimizedFile);
      if (uploadError) throw new Error(uploadError.message || "Supabase upload failed.");
      const path = linkResult.path;
      uploadedToSupabase.push({ path });
      return path;
    };

    try {
      const [printablePath, mediaPaths] = await Promise.all([
        printable ? uploadToDropbox(printable) : Promise.resolve(existingPrintablePath),
        Promise.all(images.map((image, index) => (image.kind === "new"
          ? uploadToSupabase(index === 0 ? "thumbnail" : "gallery", image.file, index === 0 ? undefined : index - 1)
          : Promise.resolve(image.path)))),
      ]);
      const [thumbnailPath = "", ...galleryPaths] = mediaPaths;

      setStatus(editing ? "Saving…" : "Publishing template…");
      const response = await fetch(editing ? `/api/templates/mine/${initialData!.id}` : "/api/templates/create", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
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
          tags: [...tags, ...tagInput.split(",").map((item) => item.trim()).filter(Boolean)],
        }),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || (editing ? "Could not save changes." : "Could not publish this template."));

      if (editing && initialData) {
        const keptImagePaths = new Set(images.filter((image) => image.kind === "existing").map((image) => image.path));
        const removedImagePaths = initialData.images.map((image) => image.path).filter((path) => !keptImagePaths.has(path));
        if (printable && existingPrintablePath) removedImagePaths.push(existingPrintablePath);

        const staleDropboxPaths = removedImagePaths.filter((path) => path.startsWith("/lvo-files/"));
        const staleSupabasePaths = removedImagePaths.filter((path) => !path.startsWith("/lvo-files/"));
        await Promise.all([
          staleDropboxPaths.length
            ? fetch("/api/dropbox/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: staleDropboxPaths }) }).catch(() => undefined)
            : null,
          staleSupabasePaths.length
            ? fetch("/api/templates/media-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: staleSupabasePaths }) }).catch(() => undefined)
            : null,
        ]);
      }

      setStatus(editing ? "Saved" : "Published");
      router.replace(editing ? "/templates/manage" : `/t/${result.id}`);
      router.refresh();
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
      setError(caughtError instanceof Error ? caughtError.message : "Could not add this template.");
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
        <div className="mt-7 space-y-5">
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
                      : "youtube.com/shorts/…, youtu.be/… or vimeo.com/… — or add a featured image below"}
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

          <Field label="Title">
            <input required maxLength={120} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Paper flower bouquet" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
          </Field>

          <Field label="Short description" optional>
            <textarea maxLength={280} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A simple activity with clear steps." className="w-full resize-none rounded-xl bg-[#f2f2f2] px-4 py-3 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
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
                onChange={(minimum, maximum) => { setMinimumAge(String(minimum ?? 0)); setMaximumAge(String(maximum ?? 18)); }}
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
            <Field label="Time in minutes">
              <input required type="number" min={1} max={1440} inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition focus:ring-2" />
            </Field>
            <Field label="Difficulty">
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

          <Field label="Supplies (comma separated)" optional>
            <input value={supplies} onChange={(event) => setSupplies(event.target.value)} placeholder="Paper, scissors, glue" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
          </Field>

          <Field label="Tags" optional>
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

          <Field label="Printable">
            <FilePicker
              required={!editing}
              icon={<FileText className="h-5 w-5" />}
              title={printable?.name ?? (existingPrintablePath ? filenameFromPath(existingPrintablePath) : "Printable file")}
              detail={printable ? `${formatFileSize(printable.size)} · Ready to upload` : existingPrintablePath ? "Already uploaded" : "Required · PDF, ZIP, JPG, PNG, or WebP · up to 25 MB"}
              selected={hasPrintable}
              accept={PRINTABLE_ACCEPT}
              onChange={selectPrintable}
            />
          </Field>
        </div>

        {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button type="submit" disabled={submitting || !mediaReady || !hasPrintable || !title.trim() || !categoryIds.length || !ageRangeValid} className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
          {submitting ? <><LoaderCircle className="h-5 w-5 animate-spin" />{status}</> : editing ? <><Check className="h-4 w-4" />Save changes</> : <><Plus className="h-4 w-4" />Publish template</>}
        </button>
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

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        {label}{optional ? <span className="text-xs font-normal text-black/35">Optional</span> : null}
      </span>
      {children}
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
