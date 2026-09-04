"use client";

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, FileText, Images, Link2, LoaderCircle, Plus, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { parseVideoEmbedUrl } from "@/lib/templates/video-embed";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

type Category = { id: string; name: string; parentId: string | null };
type UploadRecord = { path: string };

function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || (file.type === "application/pdf" ? "pdf" : "bin");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AddTemplateForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState(categories.find((category) => !category.parentId)?.id ?? "");
  const [minimumAge, setMinimumAge] = useState("4");
  const [maximumAge, setMaximumAge] = useState("8");
  const [duration, setDuration] = useState("15");
  const [difficulty, setDifficulty] = useState("easy");
  const [supplies, setSupplies] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [printable, setPrintable] = useState<File | null>(null);
  const [isFree, setIsFree] = useState(false);
  const [gallery, setGallery] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const selectPrintable = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > 25 * 1024 * 1024) {
      setError("Printable must be smaller than 25 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setPrintable(file);
  };

  const selectGallery = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 10);
    if (files.some((file) => file.size > 15 * 1024 * 1024)) {
      setError("Each gallery image must be smaller than 15 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setGallery(files);
  };

  const videoLinkEmbed = parseVideoEmbedUrl(videoUrl);
  const videoReady = Boolean(videoLinkEmbed);
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!videoReady || !printable || !title.trim() || !categoryIds.length || !ageRangeValid) return;

    setSubmitting(true);
    setError("");
    setStatus("Uploading files…");
    const uploadGroup = crypto.randomUUID();
    const uploaded: UploadRecord[] = [];

    const upload = async (folder: "printable" | "gallery", file: File, index?: number) => {
      const linkResponse = await fetch("/api/dropbox/upload-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadGroup, folder, extension: fileExtension(file), index }),
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
      uploaded.push({ path });
      return path;
    };

    try {
      const [printablePath, galleryPaths] = await Promise.all([
        upload("printable", printable),
        Promise.all(gallery.map((file, index) => upload("gallery", file, index))),
      ]);

      setStatus("Publishing template…");
      const response = await fetch("/api/templates/create", {
        method: "POST",
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
          printablePath,
          isFree,
          galleryPaths,
          supplies: supplies.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      const result = await response.json() as { slug?: string; error?: string };
      if (!response.ok || !result.slug) throw new Error(result.error || "Could not publish this template.");

      setStatus("Published");
      router.replace(`/templates/${result.slug}`);
      router.refresh();
    } catch (caughtError) {
      if (uploaded.length) {
        await fetch("/api/dropbox/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: uploaded.map(({ path }) => path) }),
        }).catch(() => undefined);
      }
      setError(caughtError instanceof Error ? caughtError.message : "Could not add this template.");
      setStatus("");
      setSubmitting(false);
    }
  };

  return (
    <main className="h-dvh overflow-y-auto overscroll-y-contain bg-[#f4f3f0] text-black">
      <form onSubmit={submit} className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold tracking-tight">New template</p>
            <p className="mt-1 text-sm text-black/45">Add the essentials and publish.</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 space-y-5">
          <Field label="Video">
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <div className="relative">
                  <Link2 aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" strokeWidth={2.25} />
                  <input
                    type="url"
                    required
                    value={videoUrl}
                    onChange={(event) => { setVideoUrl(event.target.value); setError(""); }}
                    placeholder="YouTube Shorts link"
                    className="h-12 w-full rounded-xl bg-[#f2f2f2] pl-11 pr-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2"
                  />
                </div>
                <p className="mt-1.5 text-xs text-black/35">
                  {videoUrl && !videoLinkEmbed ? "Paste a valid YouTube Shorts link." : "youtube.com/shorts/… or youtu.be/…"}
                </p>
              </div>
              {videoLinkEmbed ? (
                <div className="aspect-9/16 w-19 shrink-0 overflow-hidden rounded-xl bg-black">
                  <iframe
                    key={videoLinkEmbed.id}
                    src={`https://www.youtube-nocookie.com/embed/${videoLinkEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoLinkEmbed.id}&controls=0&rel=0&modestbranding=1&playsinline=1`}
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
                    <button key={id} type="button" onClick={() => toggleCategory(id)} className="inline-flex items-center gap-1 rounded-lg bg-black px-2.5 py-1.5 text-xs font-medium text-white">
                      {category.name}<X aria-hidden="true" className="h-3 w-3 text-white/65" />
                    </button>
                  ) : null;
                })}
              </div>
            ) : null}
          </Field>

          <Field label="Age range">
            <div className="flex items-center gap-2">
              <input required aria-label="Minimum age" type="number" min={0} max={18} inputMode="numeric" value={minimumAge} onChange={(event) => setMinimumAge(event.target.value)} className="h-12 min-w-0 flex-1 rounded-xl bg-[#f2f2f2] px-4 text-center text-sm outline-none ring-black/10 transition focus:ring-2" />
              <span className="text-xs text-black/35">to</span>
              <input required aria-label="Maximum age" type="number" min={0} max={18} inputMode="numeric" value={maximumAge} onChange={(event) => setMaximumAge(event.target.value)} className="h-12 min-w-0 flex-1 rounded-xl bg-[#f2f2f2] px-4 text-center text-sm outline-none ring-black/10 transition focus:ring-2" />
            </div>
            <p className="mt-1.5 text-xs text-black/35">Years</p>
          </Field>

          <Field label="Access">
            <button type="button" role="switch" aria-checked={isFree} onClick={() => setIsFree((value) => !value)} className="flex h-12 w-full items-center justify-between rounded-xl bg-[#f2f2f2] px-4 text-sm font-medium">
              <span>Free download</span>
              <span className={`relative h-6 w-11 rounded-full transition ${isFree ? "bg-black" : "bg-black/15"}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${isFree ? "left-6" : "left-1"}`} />
              </span>
            </button>
          </Field>

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

          <Field label="Supplies" optional>
            <input value={supplies} onChange={(event) => setSupplies(event.target.value)} placeholder="Paper, scissors, glue" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
            <p className="mt-1.5 text-xs text-black/35">Separate items with commas.</p>
          </Field>

          <Field label="Files">
            <div className="space-y-2.5">
              <FilePicker
                required
                icon={<FileText className="h-5 w-5" />}
                title={printable?.name ?? "Printable PDF"}
                detail={printable ? `${formatFileSize(printable.size)} · Ready to upload` : "Required · PDF · up to 25 MB"}
                selected={Boolean(printable)}
                accept="application/pdf"
                onChange={selectPrintable}
              />
              <FilePicker
                multiple
                icon={<Images className="h-5 w-5" />}
                title={gallery.length ? `${gallery.length} gallery image${gallery.length === 1 ? "" : "s"}` : "Gallery images"}
                detail={gallery.length ? `${formatFileSize(gallery.reduce((total, file) => total + file.size, 0))} · Ready to upload` : "Optional · JPG, PNG or WebP · up to 10"}
                selected={Boolean(gallery.length)}
                accept="image/jpeg,image/png,image/webp"
                onChange={selectGallery}
              />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-black/35">
              <Upload aria-hidden="true" className="h-3.5 w-3.5" />
              Files upload securely to Dropbox when you publish.
            </p>
          </Field>
        </div>

        {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button type="submit" disabled={submitting || !videoReady || !printable || !title.trim() || !categoryIds.length || !ageRangeValid} className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
          {submitting ? <><LoaderCircle className="h-5 w-5 animate-spin" />{status}</> : <><Plus className="h-4 w-4" />Publish template</>}
        </button>
      </form>
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
                          <button key={category.id} type="button" aria-pressed={selected} onClick={() => toggleCategory(category.id)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ${selected ? "bg-black text-white" : "bg-white text-black/55"}`}>
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
          <button type="button" onClick={() => setCategoryPickerOpen(false)} disabled={!categoryIds.length} className="mt-5 h-12 w-full rounded-xl bg-black text-sm font-semibold text-white disabled:bg-black/20">Done</button>
        </DrawerContent>
      </Drawer>
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

function FilePicker({ icon, title, detail, selected, accept, onChange, required = false, multiple = false }: { icon: ReactNode; title: string; detail: string; selected: boolean; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; required?: boolean; multiple?: boolean }) {
  return (
    <label className="flex min-h-18 cursor-pointer items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-3 transition hover:border-black/20 active:scale-[0.99]">
      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#0061ff] text-white" : "bg-[#f2f2f2] text-black/55"}`}>
        {selected ? <Check className="h-5 w-5" strokeWidth={2.5} /> : icon}
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md border-2 border-white bg-white text-[#0061ff]" aria-hidden="true">
          <DropboxMark className="h-3.5 w-3.5" />
        </span>
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
