"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, Trash2 } from "lucide-react";

import { TemplateTopBar, tabRoute } from "@/components/craft-app";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminAffiliateProduct = {
  id: string;
  name: string;
  shortName: string;
  imagePath: string;
  imageUrl: string | null;
  affiliateUrl: string;
  sortOrder: number;
  isActive: boolean;
};

type Draft = {
  id: string | null;
  name: string;
  shortName: string;
  affiliateUrl: string;
  sortOrder: string;
  isActive: boolean;
  imagePath: string;
  imageUrl: string | null;
};

const EMPTY_DRAFT: Draft = { id: null, name: "", shortName: "", affiliateUrl: "", sortOrder: "10", isActive: true, imagePath: "", imageUrl: null };
const inputClass = "h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition placeholder:text-black/35 focus:ring-2";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-black/35">{hint}</p> : null}
    </div>
  );
}

function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return extension === "jpeg" ? "jpg" : extension;
}

export function AffiliateProductsScreen({ initialProducts, subscribed }: { initialProducts: AdminAffiliateProduct[]; userId: string; subscribed: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const openNew = () => {
    setError("");
    setDraft({ ...EMPTY_DRAFT });
  };
  const openEdit = (product: AdminAffiliateProduct) => {
    setError("");
    setDraft({
      id: product.id,
      name: product.name,
      shortName: product.shortName,
      affiliateUrl: product.affiliateUrl,
      sortOrder: String(product.sortOrder),
      isActive: product.isActive,
      imagePath: product.imagePath,
      imageUrl: product.imageUrl,
    });
  };

  const uploadImage = async (file: File) => {
    const extension = fileExtension(file);
    if (!["jpg", "png", "webp"].includes(extension)) throw new Error("Use a JPG, PNG or WebP image.");
    const linkResponse = await fetch("/api/templates/media-upload-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadGroup: crypto.randomUUID(), folder: "affiliate", extension, name: file.name }),
    });
    const link = (await linkResponse.json()) as { path?: string; token?: string; error?: string };
    if (!linkResponse.ok || !link.path || !link.token) throw new Error(link.error || "Could not prepare the upload.");

    const { error: uploadError } = await createSupabaseBrowserClient().storage.from("template-media").uploadToSignedUrl(link.path, link.token, file);
    if (uploadError) throw new Error(uploadError.message || "Image upload failed.");
    return link.path;
  };

  const handleImage = async (file: File | undefined) => {
    if (!file || !draft) return;
    setUploading(true);
    setError("");
    try {
      const path = await uploadImage(file);
      setDraft((current) => (current ? { ...current, imagePath: path, imageUrl: URL.createObjectURL(file) } : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    const body = {
      name: draft.name,
      shortName: draft.shortName,
      imagePath: draft.imagePath,
      affiliateUrl: draft.affiliateUrl,
      sortOrder: Number(draft.sortOrder),
      isActive: draft.isActive,
    };
    try {
      const response = await fetch(draft.id ? `/api/affiliate-products/${draft.id}` : "/api/affiliate-products", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save this product.");
      setDraft(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this product.");
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = async () => {
    if (!draft?.id) return;
    if (!window.confirm(`Delete "${draft.shortName || draft.name}"? It will be removed from every template that uses it.`)) return;
    const response = await fetch(`/api/affiliate-products/${draft.id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      setError(result.error || "Could not delete this product.");
      return;
    }
    setDraft(null);
    router.refresh();
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white text-black">
      <TemplateTopBar canAddTemplates={false} subscribed={subscribed} activeCategory="" onCategoryChange={() => undefined} categoriesOverride={[]} onTabChange={(tab) => router.push(tabRoute(tab))} alwaysShowNav />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xl font-semibold tracking-tight">{draft ? (draft.id ? "Edit product" : "New product") : "Affiliate products"}</p>
            {draft ? (
              draft.id ? (
                <button type="button" aria-label="Delete product" onClick={removeDraft} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition active:scale-95">
                  <Trash2 className="h-5 w-5" />
                </button>
              ) : null
            ) : (
              <button type="button" onClick={openNew} className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition active:scale-95">
                <Plus className="h-4 w-4" />Add product
              </button>
            )}
          </div>

          {draft ? (
            <form onSubmit={save} className="mt-7 space-y-5">
              <Field label="Image" hint="JPG, PNG or WebP. Shown square on the template page.">
                <label className="flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-[#f2f2f2] text-center text-xs font-medium text-black/60 transition hover:bg-[#e9e9e9]">
                  {draft.imageUrl ? (
                    <img src={draft.imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : uploading ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    "Add image"
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => handleImage(event.target.files?.[0])} />
                </label>
              </Field>

              <Field label="Name">
                <input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} placeholder="Scotch Kids Scissors, 5 in" />
              </Field>

              <Field label="Short name" hint="Shown under the image on the template page.">
                <input required maxLength={30} value={draft.shortName} onChange={(event) => setDraft({ ...draft, shortName: event.target.value })} className={inputClass} placeholder="Scissors" />
              </Field>

              <Field label="Affiliate link" hint="Must start with https://">
                <input required type="url" maxLength={2000} value={draft.affiliateUrl} onChange={(event) => setDraft({ ...draft, affiliateUrl: event.target.value })} className={inputClass} placeholder="https://" />
              </Field>

              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Field label="Display order" hint="Lower numbers show first.">
                    <input type="number" min={0} value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} className={inputClass} />
                  </Field>
                </div>
                <button type="button" role="switch" aria-checked={draft.isActive} onClick={() => setDraft({ ...draft, isActive: !draft.isActive })} className="flex h-12 items-center gap-3 rounded-xl bg-[#f2f2f2] px-4 text-sm font-medium">
                  <span>Active</span>
                  <span className={`relative h-6 w-11 rounded-full transition `}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition `} />
                  </span>
                </button>
              </div>

              {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDraft(null)} className="h-12 flex-1 rounded-xl bg-[#f2f2f2] text-sm font-semibold text-black transition active:scale-95">Cancel</button>
                <button type="submit" disabled={saving || uploading || !draft.imagePath} className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">
                  {saving ? <><LoaderCircle className="h-5 w-5 animate-spin" />Saving…</> : draft.id ? <><Check className="h-4 w-4" />Save changes</> : <><Plus className="h-4 w-4" />Save product</>}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-1 text-sm text-black/50">These appear on template pages. Template authors choose from this list.</p>
              {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
              <ul className="mt-6 space-y-2">
                {initialProducts.length === 0 ? <li className="rounded-xl bg-[#f2f2f2] px-4 py-6 text-center text-sm text-black/50">No affiliate products yet.</li> : null}
                {initialProducts.map((product) => (
                  <li key={product.id}>
                    <button type="button" onClick={() => openEdit(product)} className="flex w-full items-center gap-3 rounded-xl bg-[#f2f2f2] p-3 text-left transition hover:bg-[#e9e9e9] active:scale-[0.99]">
                      {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" /> : <div className="h-12 w-12 shrink-0 rounded-lg bg-white" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.shortName}</p>
                        <p className="truncate text-xs text-black/50">{product.name}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${product.isActive ? "bg-white text-black/70" : "bg-white/60 text-black/40"}`}>{product.isActive ? "Active" : "Hidden"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
