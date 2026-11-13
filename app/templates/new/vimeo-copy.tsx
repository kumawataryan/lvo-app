"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import type { AiDraftSuggestion } from "@/lib/templates/ai-draft";
import { slugify } from "@/lib/templates/slug";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lovely.diy").replace(/\/$/, "");

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers that block the Clipboard API outside a secure context.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

function CopyRow({ label, value, copyKey, copied, onCopy, multiline = false }: {
  label: string;
  value: string;
  copyKey: string;
  copied: string;
  onCopy: (key: string, text: string) => void;
  multiline?: boolean;
}) {
  const done = copied === copyKey;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-black/45">{label}</p>
        <p className={`mt-1 whitespace-pre-line text-[13px] leading-5 text-black/80 ${multiline ? "line-clamp-4" : "truncate"}`}>{value || "—"}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(copyKey, value)}
        disabled={!value}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition disabled:opacity-40 ${done ? "bg-black text-white" : "bg-black/[0.05] text-black/75 hover:bg-black/[0.08]"}`}
      >
        {done ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
      </button>
    </div>
  );
}

// Vimeo title, description (with the template and website links) and tags, each with a copy button.
// Shown under the Video input once an AI draft has finished.
export function VimeoCopy({ suggestion, title, slug }: { suggestion: AiDraftSuggestion; title: string; slug: string }) {
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!copied) return;
    const handle = window.setTimeout(() => setCopied(""), 1500);
    return () => window.clearTimeout(handle);
  }, [copied]);

  const templateUrl = `${SITE_URL}/t/${slug.trim() || slugify(title)}`;
  const vimeoTitle = title.trim();
  const vimeoDescription = [
    suggestion.vimeoDescription || suggestion.description,
    `Download the printable template: ${templateUrl}`,
    `More craft templates: ${SITE_URL}`,
  ].join("\n\n");
  const vimeoTags = suggestion.tags.join(", ");

  const handleCopy = async (key: string, text: string) => {
    if (await copyText(text)) setCopied(key);
  };

  return (
    <section aria-label="Vimeo copy" className="rounded-2xl bg-white px-4 ring-1 ring-black/[0.08]">
      <div className="flex items-baseline justify-between gap-3 pt-4">
        <p className="text-sm font-semibold text-black">Vimeo copy</p>
        <p className="text-xs text-black/45">Paste into your video</p>
      </div>
      <div className="mt-1 divide-y divide-black/[0.06]">
        <CopyRow label="Title" value={vimeoTitle} copyKey="title" copied={copied} onCopy={handleCopy} />
        <CopyRow label="Description with links" value={vimeoDescription} copyKey="description" copied={copied} onCopy={handleCopy} multiline />
        <CopyRow label="Tags" value={vimeoTags} copyKey="tags" copied={copied} onCopy={handleCopy} />
      </div>
    </section>
  );
}

// Ten SEO file names. Each one has its own copy button, so the author can paste them one by one.
export function FilenameCopy({ names }: { names: string[] }) {
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!copied) return;
    const handle = window.setTimeout(() => setCopied(""), 1500);
    return () => window.clearTimeout(handle);
  }, [copied]);

  if (!names.length) return null;

  return (
    <section aria-label="File names" className="rounded-2xl bg-white px-4 ring-1 ring-black/[0.08]">
      <div className="flex items-baseline justify-between gap-3 pt-4">
        <p className="text-sm font-semibold text-black">File names</p>
        <p className="text-xs text-black/45">Copy one at a time</p>
      </div>
      <ul className="mt-2 divide-y divide-black/[0.06]">
        {names.map((name) => {
          const done = copied === name;
          return (
            <li key={name} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-black/80">{name}</span>
              <button
                type="button"
                onClick={async () => { if (await copyText(name)) setCopied(name); }}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${done ? "bg-black text-white" : "bg-black/[0.05] text-black/75 hover:bg-black/[0.08]"}`}
              >
                {done ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
