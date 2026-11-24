"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { optimizeImageToWebp } from "@/lib/templates/image-optimize";

// Files upload in the background as soon as they're picked, so saving a template only has to send
// the form details. Uploads that end up unused (replaced, removed, or the page is left without
// saving) are deleted again.

export type UploadStatus = { state: "uploading" | "done" | "error"; progress: number; error?: string };
type UploadKind = "printable" | "image";

type Entry = {
  kind: UploadKind;
  file: File;
  controller: AbortController;
  promise: Promise<string>;
  path?: string;
  failed?: boolean;
};

const MAX_ATTEMPTS = 3;
const IMAGE_CONCURRENCY = 4;
const DELETE_BATCH = 12;

function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || (file.type === "application/pdf" ? "pdf" : "bin");
}

function abortError() {
  return new DOMException("Upload cancelled.", "AbortError");
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Network drops and server hiccups are worth retrying; validation errors (4xx) are not. */
class RetryableError extends Error {}

async function readJson<T extends object>(response: Response): Promise<T & { error?: string }> {
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  return payload ?? ({ error: `The server returned an unexpected response (${response.status}).` } as T & { error?: string });
}

async function postJson<T extends object>(url: string, body: unknown, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new RetryableError("The connection dropped while uploading.");
  }
  const result = await readJson<T>(response);
  if (!response.ok) {
    const message = result.error || "Could not prepare the upload.";
    throw response.status >= 500 || response.status === 429 ? new RetryableError(message) : new Error(message);
  }
  return result as T;
}

/** fetch() can't report upload progress, so the printable (up to 150 MB) goes through XHR. */
function uploadWithProgress(url: string, file: File, signal: AbortSignal, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.setRequestHeader("Content-Type", "application/octet-stream");
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else if (request.status >= 500 || request.status === 429) reject(new RetryableError(`Upload failed (${request.status}).`));
      else reject(new Error(`Upload failed (${request.status}). Please pick the file again.`));
    };
    request.onerror = () => reject(new RetryableError("The connection dropped while uploading."));
    request.ontimeout = () => reject(new RetryableError("The upload timed out."));
    request.onabort = () => reject(abortError());
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
}

async function withRetries<T>(signal: AbortSignal, task: () => Promise<T>) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (isAbort(error) || !(error instanceof RetryableError) || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      if (signal.aborted) throw abortError();
    }
  }
}

async function uploadPrintable(file: File, name: string, signal: AbortSignal, onProgress: (fraction: number) => void) {
  return withRetries(signal, async () => {
    // A fresh folder per attempt: Dropbox never overwrites, so a retry can't clash with a half-finished file.
    const link = await postJson<{ path: string; uploadUrl: string }>("/api/dropbox/upload-link", {
      uploadGroup: crypto.randomUUID(),
      folder: "printable",
      extension: fileExtension(file),
      name,
    }, signal);
    if (!link.path || !link.uploadUrl) throw new RetryableError("Could not prepare the upload.");
    await uploadWithProgress(link.uploadUrl, file, signal, onProgress);
    return link.path;
  });
}

async function uploadImage(file: File, key: string, uploadGroup: string, signal: AbortSignal) {
  const optimized = await optimizeImageToWebp(file);
  if (signal.aborted) throw abortError();
  return withRetries(signal, async () => {
    const link = await postJson<{ path: string; token: string }>("/api/templates/media-upload-link", {
      uploadGroup,
      folder: "gallery",
      extension: fileExtension(optimized),
      name: optimized.name,
      key,
    }, signal);
    if (!link.path || !link.token) throw new RetryableError("Could not prepare the upload.");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.storage.from("template-media").uploadToSignedUrl(link.path, link.token, optimized);
    // The SDK reports network failures as storage errors; those are worth another try.
    if (error && /fetch|network|load failed|timeout/i.test(error.message)) throw new RetryableError(error.message);
    if (error) throw new Error(error.message || "Image upload failed.");
    return link.path;
  });
}

function deletePaths(paths: string[]) {
  const dropbox = paths.filter((path) => path.startsWith("/lvo-files/"));
  const media = paths.filter((path) => !path.startsWith("/lvo-files/"));
  const send = (url: string, list: string[]) => {
    for (let index = 0; index < list.length; index += DELETE_BATCH) {
      // keepalive lets the request finish even when this runs as the page is closing.
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: list.slice(index, index + DELETE_BATCH) }),
        keepalive: true,
      }).catch(() => undefined);
    }
  };
  if (dropbox.length) send("/api/dropbox/delete", dropbox);
  if (media.length) send("/api/templates/media-delete", media);
}

export function useEagerUploads() {
  const entries = useRef(new Map<string, Entry>());
  const savedPaths = useRef(new Set<string>());
  const uploadGroup = useRef<string | null>(null);
  const activeImages = useRef(0);
  const imageQueue = useRef<Array<() => void>>([]);
  const [statuses, setStatuses] = useState<Record<string, UploadStatus>>({});

  const setStatus = useCallback((key: string, status: UploadStatus | null) => {
    setStatuses((current) => {
      if (status === null) {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: status };
    });
  }, []);

  // Images optimize and upload a few at a time so a batch of 30 doesn't freeze the page.
  const withImageSlot = useCallback(async <T,>(signal: AbortSignal, task: () => Promise<T>) => {
    if (activeImages.current >= IMAGE_CONCURRENCY) {
      await new Promise<void>((resolve) => imageQueue.current.push(resolve));
    }
    activeImages.current += 1;
    try {
      if (signal.aborted) throw abortError();
      return await task();
    } finally {
      activeImages.current -= 1;
      imageQueue.current.shift()?.();
    }
  }, []);

  const start = useCallback((key: string, kind: UploadKind, file: File, name = "") => {
    const previous = entries.current.get(key);
    if (previous) {
      previous.controller.abort();
      if (previous.path && !savedPaths.current.has(previous.path)) deletePaths([previous.path]);
    }

    const controller = new AbortController();
    uploadGroup.current ??= crypto.randomUUID();
    const group = uploadGroup.current;
    setStatus(key, { state: "uploading", progress: 0 });

    const entry: Entry = { kind, file, controller, promise: Promise.resolve("") };
    entry.promise = (async () => {
      try {
        const path = kind === "printable"
          ? await uploadPrintable(file, name, controller.signal, (fraction) => {
            if (!controller.signal.aborted) setStatus(key, { state: "uploading", progress: Math.min(99, Math.round(fraction * 100)) });
          })
          : await withImageSlot(controller.signal, () => uploadImage(file, key.replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase(), group, controller.signal));
        if (controller.signal.aborted) {
          deletePaths([path]);
          throw abortError();
        }
        entry.path = path;
        setStatus(key, { state: "done", progress: 100 });
        return path;
      } catch (error) {
        if (!controller.signal.aborted) {
          entry.failed = true;
          setStatus(key, { state: "error", progress: 0, error: error instanceof Error ? error.message : "Upload failed." });
        }
        throw error;
      }
    })();
    // Failures are shown in the UI and retried on save; don't surface them as unhandled rejections.
    entry.promise.catch(() => undefined);
    entries.current.set(key, entry);
    return entry.promise;
  }, [setStatus, withImageSlot]);

  /** Stops an upload and deletes its file if it already finished (picked file replaced or removed). */
  const discard = useCallback((key: string) => {
    const entry = entries.current.get(key);
    if (!entry) return;
    entry.controller.abort();
    if (entry.path && !savedPaths.current.has(entry.path)) deletePaths([entry.path]);
    entries.current.delete(key);
    setStatus(key, null);
  }, [setStatus]);

  /** The uploaded path for this file: reuses a running or finished upload, restarts a failed one. */
  const ensure = useCallback((key: string, kind: UploadKind, file: File, name = "") => {
    const entry = entries.current.get(key);
    if (entry && entry.file === file && !entry.failed && !entry.controller.signal.aborted) return entry.promise;
    return start(key, kind, file, name);
  }, [start]);

  /** Paths now referenced by a saved template must never be cleaned up. */
  const markSaved = useCallback((paths: string[]) => {
    paths.forEach((path) => { if (path) savedPaths.current.add(path); });
  }, []);

  // Leaving the page (or this form) without saving: delete what was uploaded for nothing.
  useEffect(() => {
    const map = entries.current;
    const saved = savedPaths.current;
    const cleanUp = () => {
      const unused: string[] = [];
      map.forEach((entry) => {
        entry.controller.abort();
        if (entry.path && !saved.has(entry.path)) unused.push(entry.path);
      });
      map.clear();
      if (unused.length) deletePaths(unused);
    };
    window.addEventListener("pagehide", cleanUp);
    return () => {
      window.removeEventListener("pagehide", cleanUp);
      cleanUp();
    };
  }, []);

  const busy = Object.values(statuses).some((status) => status.state === "uploading");
  const pendingCount = Object.values(statuses).filter((status) => status.state !== "done").length;

  return { statuses, start, discard, ensure, markSaved, busy, pendingCount };
}
