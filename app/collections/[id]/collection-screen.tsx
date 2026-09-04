"use client";

import Image from "next/image";
import { ArrowLeft, Folder, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CHILD_AVATAR_SRC, LibraryQuickActions, TemplateCard, mapPublishedTemplate, useTemplateInteractions, type Template } from "@/components/craft-app";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublishedTemplate } from "@/lib/templates/types";

type CollectionInfo = { id: string; name: string; childAvatar: string | null };

export function CollectionScreen({ collection, templates: publishedTemplates, subscribed }: { collection: CollectionInfo; templates: PublishedTemplate[]; subscribed: boolean }) {
  const router = useRouter();
  const templates = publishedTemplates.map(mapPublishedTemplate);
  const interactions = useTemplateInteractions();
  const [quickTemplate, setQuickTemplate] = useState<Template | null>(null);
  const [collectionName, setCollectionName] = useState(collection.name);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(collection.name);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const avatarSrc = collection.childAvatar ? CHILD_AVATAR_SRC[collection.childAvatar] : null;

  const renameCollection = async () => {
    const name = renameValue.trim();
    if (!name) {
      setRenameError("Enter a collection name.");
      return;
    }
    setRenaming(true);
    setRenameError(null);
    const response = await fetch(`/api/collections/${collection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const result = await response.json().catch(() => ({}));
    setRenaming(false);
    if (!response.ok) {
      setRenameError(result.error ?? "Couldn’t rename this collection.");
      return;
    }
    setCollectionName(result.collection.name);
    setRenameOpen(false);
    router.refresh();
  };

  const deleteCollection = async () => {
    setDeleting(true);
    setDeleteError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("delete_template_collection", { collection_id_input: collection.id });
    if (error) {
      setDeleting(false);
      setDeleteError("Couldn’t delete this collection. Try again.");
      return;
    }
    router.replace("/?tab=profile");
    router.refresh();
  };

  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-white px-4 pb-8 pt-5">
        <header className="flex items-center justify-between gap-3">
          <button type="button" aria-label="Back to profile" onClick={() => router.push("/?tab=profile")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex gap-2">
            {!collection.childAvatar ? <button type="button" aria-label={`Rename ${collectionName}`} onClick={() => { setRenameValue(collectionName); setRenameError(null); setRenameOpen(true); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95"><Pencil className="h-4 w-4" /></button> : null}
            <button type="button" aria-label={`Delete ${collectionName}`} onClick={() => { setDeleteError(null); setDeleteOpen(true); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition active:scale-95"><Trash2 className="h-4 w-4" /></button>
          </div>
        </header>

        <section className="mt-9">
          {avatarSrc ? <Image src={avatarSrc} alt="" width={64} height={64} priority className="h-16 w-16 rounded-full object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f2f2f2]"><Folder className="h-6 w-6 text-black/40" /></span>}
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{collectionName}</h1>
          <p className="mt-1 text-sm text-black/40">{templates.length} {templates.length === 1 ? "template" : "templates"}</p>
        </section>

        {templates.length ? <div className="mt-7 grid grid-cols-2 gap-2">{templates.map((template) => <TemplateCard key={template.id} template={template} statusIcon="save" onOpenDetail={() => router.push(`/templates/${template.slug}`)} onQuickActions={() => setQuickTemplate(template)} />)}</div> : <div className="mt-8 rounded-2xl bg-[#f2f2f2] px-5 py-10 text-center text-sm text-black/45">No saved templates</div>}
      </div>

      {quickTemplate ? <LibraryQuickActions template={quickTemplate} interactions={interactions} subscribed={subscribed} onClose={() => setQuickTemplate(null)} /> : null}

      {renameOpen ? <Drawer open onOpenChange={(open) => { if (!open && !renaming) setRenameOpen(false); }}>
        <DrawerContent>
          <div aria-hidden="true" className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-black/15" />
          <DrawerTitle className="text-xl font-semibold tracking-tight">Rename collection</DrawerTitle>
          <DrawerDescription className="sr-only">Enter a new name for this collection.</DrawerDescription>
          <input autoFocus maxLength={60} value={renameValue} onChange={(event) => { setRenameValue(event.target.value); setRenameError(null); }} onKeyDown={(event) => { if (event.key === "Enter" && !renaming) void renameCollection(); }} aria-label="Collection name" className="mt-5 h-13 w-full rounded-xl bg-[#f2f2f2] px-4 text-base outline-none ring-black/10 transition focus:ring-2" />
          {renameError ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{renameError}</p> : null}
          <button type="button" disabled={renaming || !renameValue.trim() || renameValue.trim() === collectionName} onClick={() => void renameCollection()} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-black/15">{renaming ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Saving…</> : "Save"}</button>
          <button type="button" disabled={renaming} onClick={() => setRenameOpen(false)} className="mt-2 h-12 w-full rounded-xl bg-[#f2f2f2] text-sm font-semibold text-black disabled:opacity-50">Cancel</button>
        </DrawerContent>
      </Drawer> : null}

      {deleteOpen ? <Drawer open onOpenChange={(open) => { if (!open && !deleting) setDeleteOpen(false); }}>
        <DrawerContent>
          <div aria-hidden="true" className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-black/15" />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><Trash2 className="h-5 w-5" /></div>
          <DrawerTitle className="mt-5 text-xl font-semibold tracking-tight">Delete collection?</DrawerTitle>
          <DrawerDescription className="mt-2 text-sm leading-6 text-black/50">{collection.childAvatar ? `Saved items in “${collectionName}” will be removed. The child’s collection will stay available.` : `“${collectionName}” and its saved items will be removed.`}</DrawerDescription>
          {deleteError ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</p> : null}
          <button type="button" disabled={deleting} onClick={() => void deleteCollection()} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-50">{deleting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Deleting…</> : "Delete"}</button>
          <button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)} className="mt-2 h-12 w-full rounded-xl bg-[#f2f2f2] text-sm font-semibold text-black disabled:opacity-50">Cancel</button>
        </DrawerContent>
      </Drawer> : null}
    </main>
  );
}
