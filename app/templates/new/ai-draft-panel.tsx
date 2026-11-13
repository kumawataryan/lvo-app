"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";

import type { AiDifficulty, AiDraftField, AiDraftSuggestion } from "@/lib/templates/ai-draft";
import { toAiContextUrl } from "@/lib/templates/ai-image-context";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import type { TemplateImage } from "./image-reorder-field";

const MAX_CONTEXT_IMAGES = 3;
const MAX_NOTES = 500;
const TYPE_SPEED = { description: 13, supplies: 10, tags: 12, metaTitle: 14, metaDescription: 11 };

export type AiDraftContext = {
  title: string;
  categoryNames: string[];
  minimumAge: number;
  maximumAge: number;
  difficulty: AiDifficulty;
  durationMinutes: number;
};

// What the agent writes into the form right now. `field` is the one being typed (null when finished).
export type AiWrite = {
  field: AiDraftField | null;
  description?: string;
  supplies?: string;
  tags?: string[];
  durationMinutes?: number;
  difficulty?: AiDifficulty;
  metaTitle?: string;
  metaDescription?: string;
};

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

// Shared AI state. The trigger (button + context popup) and the results are rendered in different places in the form.
export function useAiFill({ context, images, onWrite, onPickTitle, onSuggestion }: {
  context: AiDraftContext;
  images: TemplateImage[];
  onWrite: (update: AiWrite) => void;
  onPickTitle: (title: string) => void;
  onSuggestion: (suggestion: AiDraftSuggestion | null) => void;
}) {
  const [notes, setNotes] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "writing" | "done">("idle");
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<AiDraftSuggestion | null>(null);
  const [visibleTitles, setVisibleTitles] = useState(0);
  const latest = useRef({ context, images, onWrite, onSuggestion });
  const runRef = useRef(0);
  const skipRef = useRef(false);

  useEffect(() => {
    latest.current = { context, images, onWrite, onSuggestion };
  });
  // Cancel any running animation when the form unmounts.
  useEffect(() => () => {
    runRef.current += 1;
  }, []);

  const titleReady = context.title.trim().length >= 3;
  const busy = phase === "thinking" || phase === "writing";

  const writeSequence = async (result: AiDraftSuggestion, id: number) => {
    const write = latest.current.onWrite;
    const cancelled = () => runRef.current !== id;
    const stop = () => skipRef.current || cancelled();

    const typeText = async (key: "description" | "supplies" | "metaTitle" | "metaDescription", full: string) => {
      for (let index = 1; index <= full.length; index++) {
        if (stop()) return;
        const partial = full.slice(0, index);
        write(
          key === "description" ? { field: "description", description: partial }
            : key === "supplies" ? { field: "supplies", supplies: partial }
              : key === "metaTitle" ? { field: "meta", metaTitle: partial }
                : { field: "meta", metaDescription: partial },
        );
        await sleep(TYPE_SPEED[key] + Math.random() * 6);
      }
    };

    await typeText("description", result.description);
    await typeText("supplies", result.supplies.join(", "));
    await typeText("metaTitle", result.metaTitle);
    await typeText("metaDescription", result.metaDescription);

    // Tags type one at a time: the tag being typed is the last chip in the list.
    const finishedTags: string[] = [];
    for (const tag of result.tags) {
      for (let index = 1; index <= tag.length; index++) {
        if (stop()) break;
        write({ field: "tags", tags: [...finishedTags, tag.slice(0, index)] });
        await sleep(TYPE_SPEED.tags + Math.random() * 6);
      }
      if (stop()) break;
      finishedTags.push(tag);
    }

    // Time and level land together.
    if (!stop()) {
      write({ field: "time", durationMinutes: result.durationMinutes, difficulty: result.difficulty });
      await sleep(350);
    }
    for (let count = 1; count <= result.titleIdeas.length; count++) {
      if (stop()) break;
      setVisibleTitles(count);
      await sleep(160);
    }
    setVisibleTitles(result.titleIdeas.length);
    if (!stop()) await sleep(250);

    // Final state: full, untruncated values even when the animation was skipped.
    if (!cancelled()) {
      write({
        field: null,
        description: result.description,
        metaTitle: result.metaTitle,
        metaDescription: result.metaDescription,
        supplies: result.supplies.join(", "),
        tags: result.tags,
        durationMinutes: result.durationMinutes,
        difficulty: result.difficulty,
      });
      setPhase("done");
      latest.current.onSuggestion(result);
    }
  };

  const generate = async (extraNotes: string) => {
    const { context: current, images: currentImages } = latest.current;
    if (!titleReady) {
      setError("Type a title first (at least 3 letters).");
      return;
    }

    const id = runRef.current + 1;
    runRef.current = id;
    skipRef.current = false;
    setError("");
    setSuggestion(null);
    setVisibleTitles(0);
    latest.current.onSuggestion(null);
    setPhase("thinking");

    try {
      const imageUrls = (await Promise.all(currentImages.slice(0, MAX_CONTEXT_IMAGES).map((image) => toAiContextUrl(
        image.kind === "new" ? { kind: "new", file: image.file } : { kind: "existing", url: image.url },
      )))).filter((url): url is string => Boolean(url));

      const response = await fetch("/api/templates/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...current, title: current.title.trim(), notes: extraNotes.trim(), imageUrls }),
      });
      const result = await response.json() as { suggestion?: AiDraftSuggestion; error?: string };
      if (!response.ok || !result.suggestion) throw new Error(result.error || "Could not fill this template.");
      if (runRef.current !== id) return;

      setSuggestion(result.suggestion);
      setPhase("writing");
      await writeSequence(result.suggestion, id);
    } catch (caught) {
      if (runRef.current !== id) return;
      setError(caught instanceof Error ? caught.message : "Could not fill this template.");
      setPhase("idle");
    }
  };

  const trigger = (
    <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={busy || !titleReady}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-semibold text-white transition hover:bg-black/85 active:scale-[0.99] disabled:bg-black/15"
        >
          {busy ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />{phase === "thinking" ? "Working…" : "Writing…"}</>
            : <><Sparkles className="h-3.5 w-3.5" />Write for me</>}
        </button>
      <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md">
            <DrawerTitle className="text-base font-semibold tracking-tight text-black">Add context</DrawerTitle>
            <DrawerDescription className="mt-1 text-[13px] leading-5 text-black/55">
              Optional. Anything here is used as a fact in the listing.
            </DrawerDescription>

            <div className="relative mt-4">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value.slice(0, MAX_NOTES))}
                rows={4}
                autoFocus
                aria-label="Extra context"
                placeholder="e.g. Made from recycled cereal boxes, best for two children to share"
                className="w-full resize-none rounded-xl bg-black/[0.035] px-3.5 py-3 pb-7 text-sm leading-5 text-black outline-none ring-1 ring-transparent transition placeholder:text-black/35 focus:bg-white focus:ring-black/15"
              />
              <span className="pointer-events-none absolute bottom-2.5 right-3.5 text-[11px] tabular-nums text-black/35">{notes.length}/{MAX_NOTES}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setDialogOpen(false); void generate(""); }}
                className="h-11 rounded-xl bg-black/[0.05] text-sm font-medium text-black/75 transition hover:bg-black/[0.08] active:scale-[0.99]"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => { setDialogOpen(false); void generate(notes); }}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-black text-sm font-semibold text-white transition hover:bg-black/85 active:scale-[0.99]"
              >
                <Sparkles className="h-3.5 w-3.5" />Write for me
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );

  const results = (
    <div className="mt-3 space-y-4">
      {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
      {phase === "writing" ? (
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-black/50"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" />Writing into the form</span>
          <button type="button" onClick={() => { skipRef.current = true; }} className="text-xs font-medium text-black/60 hover:text-black">Skip</button>
        </div>
      ) : null}

      {suggestion && phase !== "thinking" ? (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Title ideas</p>
            {suggestion.titleIdeas.length ? (
              <ul className="mt-2 space-y-1.5">
                {suggestion.titleIdeas.slice(0, visibleTitles).map((idea, index) => {
                  const selected = idea === context.title.trim();
                  return (
                    <li key={idea} className="animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onPickTitle(idea)}
                        className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13px] leading-5 transition ${selected ? "bg-black/[0.05] font-medium text-black ring-1 ring-black/80" : "bg-[#f7f7f8] text-black/80 ring-1 ring-transparent hover:bg-white hover:ring-black/10"}`}
                      >
                        <span className="min-w-0 flex-1">{idea}</span>
                        {selected ? <Check className="h-4 w-4 shrink-0 text-black" strokeWidth={2.5} /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-2 text-xs text-black/50">No title ideas came back. Try again.</p>}
          </div>

        </div>
      ) : null}

    </div>
  );

  return { trigger, results };
}
