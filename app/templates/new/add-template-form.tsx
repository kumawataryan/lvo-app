"use client";

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { ChevronDown, FileText, Images, LoaderCircle, Plus, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };
type UploadRecord = { bucket: "template-media" | "template-printables"; path: string };

function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || (file.type === "application/pdf" ? "pdf" : "bin");
}

export function AddTemplateForm({ categories, userId }: { categories: Category[]; userId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [duration, setDuration] = useState("15");
  const [difficulty, setDifficulty] = useState("easy");
  const [supplies, setSupplies] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [printable, setPrintable] = useState<File | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const selectVideo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > 100 * 1024 * 1024) {
      setError("Video must be smaller than 100 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setVideo(file);
  };

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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!video || !printable || !title.trim() || !categoryId) return;

    setSubmitting(true);
    setError("");
    setStatus("Uploading files…");
    const supabase = createSupabaseBrowserClient();
    const uploadGroup = crypto.randomUUID();
    const uploaded: UploadRecord[] = [];

    const upload = async (bucket: UploadRecord["bucket"], folder: string, file: File, index?: number) => {
      const suffix = index === undefined ? "" : `-${index + 1}`;
      const path = `${userId}/${uploadGroup}/${folder}${suffix}.${fileExtension(file)}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploaded.push({ bucket, path });
      return path;
    };

    try {
      const [videoPath, printablePath, galleryPaths] = await Promise.all([
        upload("template-media", "video", video),
        upload("template-printables", "printable", printable),
        Promise.all(gallery.map((file, index) => upload("template-media", "gallery", file, index))),
      ]);

      setStatus("Publishing template…");
      const response = await fetch("/api/templates/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          categoryId,
          durationMinutes: Number(duration),
          difficulty,
          videoPath,
          printablePath,
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
      await Promise.allSettled(uploaded.map(({ bucket, path }) => supabase.storage.from(bucket).remove([path])));
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
          <button type="button" aria-label="Close" onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 space-y-5">
          <FilePicker
            required
            icon={<Video className="h-5 w-5" />}
            title={video ? video.name : "Add template video"}
            detail={video ? `${(video.size / 1024 / 1024).toFixed(1)} MB` : "MP4 or WebM · up to 100 MB"}
            accept="video/mp4,video/webm"
            onChange={selectVideo}
          />

          <Field label="Title">
            <input required maxLength={120} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Paper flower bouquet" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
          </Field>

          <Field label="Short description" optional>
            <textarea maxLength={280} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A simple activity with clear steps." className="w-full resize-none rounded-xl bg-[#f2f2f2] px-4 py-3 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Category">
              <div className="relative">
                <select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-12 w-full appearance-none rounded-xl bg-[#f2f2f2] py-0 pl-4 pr-10 text-sm outline-none ring-black/10 transition focus:ring-2">
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" strokeWidth={2.25} />
              </div>
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

          <Field label="Time in minutes">
            <input required type="number" min={1} max={1440} inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition focus:ring-2" />
          </Field>

          <Field label="Supplies" optional>
            <input value={supplies} onChange={(event) => setSupplies(event.target.value)} placeholder="Paper, scissors, glue" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2" />
            <p className="mt-1.5 text-xs text-black/35">Separate items with commas.</p>
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <FilePicker required compact icon={<FileText className="h-5 w-5" />} title={printable ? printable.name : "Printable PDF"} detail={printable ? "Selected" : "Required · up to 25 MB"} accept="application/pdf" onChange={selectPrintable} />
            <FilePicker compact multiple icon={<Images className="h-5 w-5" />} title={gallery.length ? `${gallery.length} image${gallery.length === 1 ? "" : "s"}` : "Gallery images"} detail={gallery.length ? "Selected" : "Optional · up to 10"} accept="image/jpeg,image/png,image/webp" onChange={selectGallery} />
          </div>
        </div>

        {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button type="submit" disabled={submitting || !video || !printable || !title.trim() || !categoryId} className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20">
          {submitting ? <><LoaderCircle className="h-5 w-5 animate-spin" />{status}</> : <><Plus className="h-4 w-4" />Publish template</>}
        </button>
      </form>
    </main>
  );
}

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        {label}{optional ? <span className="text-xs font-normal text-black/35">Optional</span> : null}
      </span>
      {children}
    </label>
  );
}

function FilePicker({ icon, title, detail, accept, onChange, required = false, multiple = false, compact = false }: { icon: ReactNode; title: string; detail: string; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; required?: boolean; multiple?: boolean; compact?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-center bg-[#f2f2f2] transition active:scale-[0.99] ${compact ? "min-h-24 flex-col justify-center rounded-xl px-3 py-4 text-center" : "min-h-20 gap-4 rounded-2xl px-4 py-3"}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-white ${compact ? "mb-2 h-9 w-9" : "h-12 w-12"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-black/40">{detail}</span>
      </span>
      <input type="file" required={required} multiple={multiple} accept={accept} onChange={onChange} className="sr-only" />
    </label>
  );
}
