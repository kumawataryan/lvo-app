"use client";

import { useMemo, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, CloudUpload, Download, FileSpreadsheet, FolderOpen, LoaderCircle } from "lucide-react";

import { parseVideoEmbedUrl } from "@/lib/templates/video-embed";
import { csvToRecords, splitList, type CsvRecord } from "@/lib/templates/csv";
import { optimizeImageToWebp } from "@/lib/templates/image-optimize";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; parentId: string | null };
type RowStatus = "pending" | "uploading" | "done" | "error";

type ResolvedRow = {
  index: number;
  errors: string[];
  title: string;
  description: string;
  categoryIds: string[];
  minimumAge: number;
  maximumAge: number;
  durationMinutes: number;
  difficulty: string;
  isFree: boolean;
  videoUrl: string;
  featuredImageFile: File | null;
  galleryFiles: File[];
  printableFile: File | null;
  supplies: string[];
  tags: string[];
  status: RowStatus;
  message: string;
};

const DIFFICULTIES = new Set(["easy", "medium", "advanced"]);
const CSV_TEMPLATE = `title,description,categories,minimumAge,maximumAge,durationMinutes,difficulty,isFree,videoUrl,featuredImage,galleryImages,printable,supplies,tags
Paper Flower Bouquet,A calm paper flower activity with clear steps.,Paper;DIY,4,8,15,easy,true,https://youtube.com/shorts/xxxxxxxxxxx,flower-cover.jpg,flower-1.jpg;flower-2.jpg,flower-printable.pdf,"Paper,Scissors,Glue",flowers;paper craft
`;

const PRINTABLE_EXTENSIONS = ["pdf", "zip", "jpg", "jpeg", "png", "webp"];

function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || (file.type === "application/pdf" ? "pdf" : "bin");
}

function basename(path: string) {
  return path.split("/").pop() ?? path;
}

function buildFileMap(files: File[]) {
  const map = new Map<string, File>();
  for (const file of files) {
    const relative = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const key = basename(relative).toLowerCase();
    if (!map.has(key)) map.set(key, file);
  }
  return map;
}

function resolveRow(index: number, raw: CsvRecord, categories: Category[], fileMap: Map<string, File>): ResolvedRow {
  const errors: string[] = [];
  const title = (raw.title ?? "").trim();
  const description = (raw.description ?? "").trim();

  if (!title || title.length > 120) errors.push("Title is required and must be 120 characters or fewer.");
  if (description.length > 280) errors.push("Description must be 280 characters or fewer.");

  const categoryNames = splitList(raw.categories ?? "");
  const categoryIds: string[] = [];
  const missingCategories: string[] = [];
  for (const name of categoryNames) {
    const match = categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
    if (match) categoryIds.push(match.id);
    else missingCategories.push(name);
  }
  if (!categoryNames.length) errors.push("At least one category is required.");
  if (missingCategories.length) errors.push(`Unknown categor${missingCategories.length === 1 ? "y" : "ies"}: ${missingCategories.join(", ")}.`);

  const minimumAge = Number(raw.minimumage);
  const maximumAge = Number(raw.maximumage);
  if (!Number.isInteger(minimumAge) || !Number.isInteger(maximumAge) || minimumAge < 0 || maximumAge > 18 || minimumAge > maximumAge) {
    errors.push("Minimum/maximum age must be whole numbers between 0 and 18 (min ≤ max).");
  }

  const durationMinutes = Number(raw.durationminutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    errors.push("Duration must be a whole number of minutes between 1 and 1440.");
  }

  const difficulty = (raw.difficulty ?? "").trim().toLowerCase();
  if (!DIFFICULTIES.has(difficulty)) errors.push("Difficulty must be easy, medium, or advanced.");

  const isFreeRaw = (raw.isfree ?? "").trim().toLowerCase();
  const isFree = ["true", "yes", "1", "y"].includes(isFreeRaw);

  const videoUrl = (raw.videourl ?? "").trim();
  if (videoUrl && !parseVideoEmbedUrl(videoUrl)) errors.push("Video URL must be a valid YouTube or Vimeo link.");

  const featuredImageName = (raw.featuredimage ?? "").trim();
  let featuredImageFile: File | null = null;
  if (featuredImageName) {
    featuredImageFile = fileMap.get(basename(featuredImageName).toLowerCase()) ?? null;
    if (!featuredImageFile) errors.push(`Featured image "${featuredImageName}" was not found in the selected folder.`);
  }

  const galleryNames = splitList(raw.galleryimages ?? "").slice(0, 10);
  const galleryFiles: File[] = [];
  for (const name of galleryNames) {
    const file = fileMap.get(basename(name).toLowerCase());
    if (file) galleryFiles.push(file);
    else errors.push(`Gallery image "${name}" was not found in the selected folder.`);
  }

  const printableName = (raw.printable ?? "").trim();
  let printableFile: File | null = null;
  if (!printableName) {
    errors.push("A printable filename is required.");
  } else {
    printableFile = fileMap.get(basename(printableName).toLowerCase()) ?? null;
    if (!printableFile) errors.push(`Printable "${printableName}" was not found in the selected folder.`);
    else if (!PRINTABLE_EXTENSIONS.includes(fileExtension(printableFile))) errors.push(`Printable "${printableName}" must be a PDF, ZIP, JPG, PNG, or WebP file.`);
  }

  if (!videoUrl && !featuredImageFile && !galleryFiles.length) {
    errors.push("Add a video URL, featured image, or at least one gallery image.");
  }

  const supplies = splitList(raw.supplies ?? "").slice(0, 20);
  const tags = splitList(raw.tags ?? "").map((tag) => tag.toLowerCase()).slice(0, 20);

  return {
    index, errors, title, description, categoryIds, minimumAge, maximumAge, durationMinutes,
    difficulty, isFree, videoUrl, featuredImageFile, galleryFiles, printableFile, supplies, tags,
    status: "pending", message: "",
  };
}

async function uploadToDropbox(uploadGroup: string, file: File) {
  const linkResponse = await fetch("/api/dropbox/upload-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadGroup, folder: "printable", extension: fileExtension(file) }),
  });
  const linkResult = await linkResponse.json() as { path?: string; uploadUrl?: string; error?: string };
  if (!linkResponse.ok || !linkResult.path || !linkResult.uploadUrl) throw new Error(linkResult.error || "Could not prepare file upload.");
  const uploadResponse = await fetch(linkResult.uploadUrl, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
  if (!uploadResponse.ok) throw new Error(`Dropbox upload failed (${uploadResponse.status}).`);
  return linkResult.path;
}

async function uploadToSupabase(uploadGroup: string, folder: "gallery" | "thumbnail", file: File, index?: number) {
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
  return linkResult.path;
}

async function importRow(row: ResolvedRow): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uploadGroup = crypto.randomUUID();
  const uploadedToDropbox: string[] = [];
  const uploadedToSupabase: string[] = [];
  try {
    const printablePath = await uploadToDropbox(uploadGroup, row.printableFile!);
    uploadedToDropbox.push(printablePath);

    const thumbnailPath = row.featuredImageFile ? await uploadToSupabase(uploadGroup, "thumbnail", row.featuredImageFile) : "";
    if (thumbnailPath) uploadedToSupabase.push(thumbnailPath);

    const galleryPaths: string[] = [];
    for (let i = 0; i < row.galleryFiles.length; i += 1) {
      const path = await uploadToSupabase(uploadGroup, "gallery", row.galleryFiles[i], i);
      galleryPaths.push(path);
      uploadedToSupabase.push(path);
    }

    const response = await fetch("/api/templates/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: row.title,
        description: row.description,
        categoryIds: row.categoryIds,
        minimumAge: row.minimumAge,
        maximumAge: row.maximumAge,
        durationMinutes: row.durationMinutes,
        difficulty: row.difficulty,
        videoUrl: row.videoUrl,
        thumbnailPath,
        printablePath,
        isFree: row.isFree,
        galleryPaths,
        supplies: row.supplies,
        tags: row.tags,
        status: "draft",
      }),
    });
    const result = await response.json() as { id?: string; error?: string };
    if (!response.ok || !result.id) throw new Error(result.error || "Could not create this template.");
    return { ok: true, id: result.id };
  } catch (error) {
    if (uploadedToDropbox.length) {
      await fetch("/api/dropbox/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: uploadedToDropbox }),
      }).catch(() => undefined);
    }
    if (uploadedToSupabase.length) {
      await fetch("/api/templates/media-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: uploadedToSupabase }),
      }).catch(() => undefined);
    }
    return { ok: false, error: error instanceof Error ? error.message : "Import failed." };
  }
}

const folderInputProps: InputHTMLAttributes<HTMLInputElement> & Record<string, string> = {
  webkitdirectory: "true",
  directory: "true",
  mozdirectory: "true",
};

export function ImportTemplatesPanel({ categories }: { categories: Category[] }) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ResolvedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);

  const validCount = useMemo(() => rows.filter((row) => !row.errors.length).length, [rows]);
  const doneCount = useMemo(() => rows.filter((row) => row.status === "done").length, [rows]);

  const parse = (csv: File | null, files: File[]) => {
    if (!csv) {
      setRows([]);
      setParseError("");
      return;
    }
    csv.text().then((text) => {
      const records = csvToRecords(text);
      if (!records.length) {
        setRows([]);
        setParseError("No rows found in this CSV.");
        return;
      }
      const fileMap = buildFileMap(files);
      setParseError("");
      setRows(records.map((record, index) => resolveRow(index, record, categories, fileMap)));
    }).catch(() => setParseError("Could not read this CSV file."));
  };

  const selectCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCsvFile(file);
    parse(file, folderFiles);
  };

  const selectFolder = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setFolderFiles(files);
    parse(csvFile, files);
  };

  const downloadSample = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-import-sample.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    setImporting(true);
    for (const row of rows) {
      if (row.errors.length || row.status === "done") continue;
      setRows((current) => current.map((item) => (item.index === row.index ? { ...item, status: "uploading", message: "" } : item)));
      const result = await importRow(row);
      setRows((current) => current.map((item) => {
        if (item.index !== row.index) return item;
        return result.ok
          ? { ...item, status: "done", message: `Saved as draft (${result.id.slice(0, 8)})` }
          : { ...item, status: "error", message: result.error };
      }));
    }
    setImporting(false);
  };

  return (
    <div className="mt-7 space-y-5">
      <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-4">
        <p className="text-sm font-semibold">CSV format</p>
        <p className="mt-1.5 text-xs leading-5 text-black/55">
          One row per template with columns: title, description, categories, minimumAge, maximumAge, durationMinutes, difficulty, isFree, videoUrl, featuredImage, galleryImages, printable, supplies, tags.
          Separate multiple categories, gallery images, supplies, or tags with a comma or semicolon. <span className="font-medium text-black/70">featuredImage</span>, <span className="font-medium text-black/70">galleryImages</span>, and <span className="font-medium text-black/70">printable</span> must match filenames inside the folder you select below — subfolders are fine.
        </p>
        <button type="button" onClick={downloadSample} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-black underline underline-offset-2">
          <Download className="h-3.5 w-3.5" /> Download a sample CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-18 cursor-pointer items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-3 transition hover:border-black/20 active:scale-[0.99]">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${csvFile ? "bg-brand text-white" : "bg-[#f2f2f2] text-black/55"}`}>
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{csvFile?.name ?? "Choose CSV file"}</span>
            <span className="mt-0.5 block truncate text-xs text-black/40">{csvFile ? "Ready" : "Template details + tags"}</span>
          </span>
          <input type="file" accept=".csv,text/csv" onChange={selectCsv} className="sr-only" />
        </label>

        <label className="flex min-h-18 cursor-pointer items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-3 transition hover:border-black/20 active:scale-[0.99]">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${folderFiles.length ? "bg-brand text-white" : "bg-[#f2f2f2] text-black/55"}`}>
            <FolderOpen className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{folderFiles.length ? `${folderFiles.length} files` : "Choose media folder"}</span>
            <span className="mt-0.5 block truncate text-xs text-black/40">Videos, images &amp; PDFs</span>
          </span>
          <input type="file" multiple onChange={selectFolder} className="sr-only" {...folderInputProps} />
        </label>
      </div>

      {parseError ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{parseError}</p> : null}

      {rows.length ? (
        <div>
          <p className="text-sm font-medium text-black/70">{validCount} of {rows.length} row{rows.length === 1 ? "" : "s"} ready{doneCount ? ` · ${doneCount} imported` : ""}</p>
          <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
            {rows.map((row) => (
              <div key={row.index} className="flex items-start gap-3 rounded-xl border border-black/10 bg-white px-3 py-2.5">
                <span className="mt-0.5 shrink-0">
                  {row.status === "done" ? <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                    : row.status === "error" ? <AlertCircle className="h-4.5 w-4.5 text-red-600" />
                    : row.status === "uploading" ? <LoaderCircle className="h-4.5 w-4.5 animate-spin text-black/40" />
                    : row.errors.length ? <AlertCircle className="h-4.5 w-4.5 text-amber-500" />
                    : <span className="block h-4.5 w-4.5 rounded-full border-2 border-black/15" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.title || `Row ${row.index + 2}`}</p>
                  {row.errors.length ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                      {row.errors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  ) : row.message ? (
                    <p className={`mt-0.5 text-xs ${row.status === "error" ? "text-red-600" : "text-black/45"}`}>{row.message}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={!validCount || importing}
        onClick={runImport}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/20"
      >
        {importing ? <><LoaderCircle className="h-5 w-5 animate-spin" />Importing…</> : <><CloudUpload className="h-4 w-4" />Import {validCount || ""} template{validCount === 1 ? "" : "s"} as drafts</>}
      </button>
    </div>
  );
}
