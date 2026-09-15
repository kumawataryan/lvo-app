"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, LoaderCircle, Mars, Plus, Trash2, Venus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FamilyOnboarding } from "@/lib/onboarding/server";

const AVATARS = ["fox", "bear", "bunny", "lion", "panda", "frog", "koala", "cat", "dog", "owl", "unicorn", "dino"].map((id, index) => ({ id, src: `/avatars/avatar_${String(index + 1).padStart(2, "0")}.png` }));
type Kid = { id?: string; name: string; birthYear: string; avatar: string; gender: string | null };
type Screen = "parent" | "onboarding" | "list" | "edit";
const GENDERS = [{ id: "boy", label: "Boy", icon: Mars }, { id: "girl", label: "Girl", icon: Venus }];
const freshKid = (index: number): Kid => ({ name: "", birthYear: "", avatar: AVATARS[index % AVATARS.length].id, gender: "boy" });
const avatarFor = (id: string) => AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0];

export function OnboardingFlow({ initialFamily }: { initialFamily: FamilyOnboarding }) {
  const router = useRouter();
  const initialKids = initialFamily.kids.map((kid) => ({ id: kid.id, name: kid.name, birthYear: String(kid.birthYear), avatar: kid.avatar, gender: kid.gender }));
  const [screen, setScreen] = useState<Screen>(initialFamily.completed ? "list" : "parent");
  const [parentName, setParentName] = useState(initialFamily.parentName);
  const [kids, setKids] = useState<Kid[]>(initialKids);
  const [pendingKids, setPendingKids] = useState<Kid[]>([]);
  const [onboardingKid, setOnboardingKid] = useState<Kid>(() => freshKid(initialKids.length));
  const [editKid, setEditKid] = useState<Kid | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [yearPage, setYearPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const year = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(() => Array.from({ length: 12 }, (_, i) => year - yearPage * 12 - i).filter((item) => item >= 1920), [year, yearPage]);
  const formKid = screen === "edit" ? editKid : onboardingKid;

  function updateForm(patch: Partial<Kid>) {
    setError(null);
    if (screen === "edit") setEditKid((kid) => kid ? { ...kid, ...patch } : kid);
    else setOnboardingKid((kid) => ({ ...kid, ...patch }));
  }

  async function persist(items: Kid[]) {
    setSaving(true); setError(null);
    try {
      const payload = items.map((kid, index) => ({ ...kid, name: kid.name.trim() || `Child ${index + 1}` }));
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentName, kids: payload }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error ?? "We couldn’t save your details."); return null; }
      return (result.kids ?? payload) as Kid[];
    } finally { setSaving(false); }
  }

  function valid() {
    if (formKid?.birthYear) return true;
    setError("Choose a birth year."); return false;
  }

  function openEdit(index: number | null) {
    setEditIndex(index); setEditKid(index === null ? freshKid(kids.length) : { ...kids[index] });
    setConfirmRemove(false); setError(null); setScreen("edit");
  }

  async function saveEdit() {
    if (!valid() || !editKid) return;
    const next = editIndex === null ? [...kids, editKid] : kids.map((kid, index) => index === editIndex ? editKid : kid);
    const saved = await persist(next);
    if (saved) { setKids(saved); setEditKid(null); setScreen("list"); }
  }

  async function removeKid() {
    if (editIndex === null) return;
    const saved = await persist(kids.filter((_, index) => index !== editIndex));
    if (saved) { setKids(saved); setEditKid(null); setScreen("list"); }
  }

  function back() {
    setError(null);
    if (screen === "onboarding" && pendingKids.length) {
      setOnboardingKid(pendingKids.at(-1)!); setPendingKids((items) => items.slice(0, -1)); return;
    }
    if (screen === "onboarding") setScreen("parent");
    else if (screen === "edit") setScreen("list");
    else router.replace("/profile");
  }

  function openYears() {
    const selected = Number(formKid?.birthYear);
    setYearPage(selected ? Math.floor((year - selected) / 12) : 0); setYearOpen(true);
  }

  const onboarding = screen === "parent" || screen === "onboarding";
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#f4f3f0] text-black">
      <div className="flex min-h-dvh w-full flex-col bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <header className="flex h-11 items-center justify-between">
          {screen === "parent" ? <Image src="/lvo.jpg" alt="Lovely Vibes Only" width={44} height={44} priority className="h-11 w-11 rounded-xl object-cover" /> : <button type="button" aria-label="Go back" disabled={saving} onClick={back} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] active:scale-95"><ArrowLeft className="h-5 w-5" /></button>}
          {onboarding ? <div className="flex gap-1" aria-label={`Step ${screen === "parent" ? 1 : 2} of 2`}><span className="h-1 w-5 rounded-full bg-black" /><span className={`h-1 w-5 rounded-full ${screen === "onboarding" ? "bg-black" : "bg-black/12"}`} /></div> : null}
        </header>

        <div className="mx-auto flex w-full max-w-none flex-1 flex-col min-[1033px]:max-w-3xl">
        {screen === "parent" ? <section className="flex flex-1 flex-col pt-[18vh]">
          <h1 className="text-3xl font-semibold tracking-tight">Your name</h1>
          <input aria-label="Your name" autoFocus maxLength={60} autoComplete="name" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Name (optional)" className="mt-8 h-14 rounded-xl bg-[#f2f2f2] px-4 outline-none ring-black/10 placeholder:text-black/35 focus:ring-2" />
          <div className="mt-auto pt-10"><button type="button" onClick={() => setScreen("onboarding")} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white">Continue <ArrowRight className="h-4 w-4" /></button><button type="button" onClick={() => { setParentName(""); setScreen("onboarding"); }} className="mt-2 h-12 w-full text-sm font-medium text-black/45">Skip</button></div>
        </section> : null}

        {screen === "list" ? <section className="flex flex-1 flex-col pt-10">
          <h1 className="text-3xl font-semibold tracking-tight">Manage kids</h1>
          <div className="mt-8 overflow-hidden rounded-2xl border border-black/8">
            {kids.map((kid, index) => <button key={kid.id ?? index} type="button" onClick={() => openEdit(index)} className={`flex min-h-20 w-full items-center gap-3 px-4 text-left active:bg-black/[.03] ${index ? "border-t border-black/8" : ""}`}><Image src={avatarFor(kid.avatar).src} alt="" width={48} height={48} className="h-12 w-12 rounded-full bg-[#f2f2f2] object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{kid.name}</span><span className="mt-0.5 block text-sm text-black/45">Born {kid.birthYear}</span></span><ChevronRight className="h-5 w-5 text-black/25" /></button>)}
            {!kids.length ? <div className="px-4 py-8 text-center text-sm text-black/45">No children added yet</div> : null}
          </div>
          {kids.length < 5 ? <button type="button" onClick={() => openEdit(null)} className="mt-3 flex h-13 items-center justify-center gap-2 rounded-xl border border-black/15 text-sm font-semibold"><Plus className="h-4 w-4" /> Add child</button> : null}
        </section> : null}

        {(screen === "onboarding" || screen === "edit") && formKid ? <section className="flex flex-1 flex-col pt-10">
          <h1 className="text-3xl font-semibold tracking-tight">{screen === "onboarding" ? "Add your child" : editIndex === null ? "Add child" : `Edit ${formKid.name || "child"}`}</h1>
          <div className="mt-8">
            <div className="-mx-5 overflow-x-auto pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="ml-5 flex w-max gap-3">{AVATARS.map((item, index) => { const selected = formKid.avatar === item.id; return <button key={item.id} type="button" aria-label={`Avatar ${index + 1}`} aria-pressed={selected} onClick={() => updateForm({ avatar: item.id })} className={`relative h-[72px] w-[72px] shrink-0 rounded-full bg-[#f2f2f2] active:scale-90 ${selected ? "ring-2 ring-black ring-offset-2" : ""}`}><Image src={item.src} alt="" width={72} height={72} className="h-full w-full rounded-full object-cover" />{selected ? <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-black text-white"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span> : null}</button>; })}</div></div>
            <div className="mt-7 space-y-3"><input aria-label="Child name" autoFocus maxLength={40} value={formKid.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="Name" className="h-14 w-full rounded-xl bg-[#f2f2f2] px-4 outline-none ring-black/10 placeholder:text-black/35 focus:ring-2" /><button type="button" onClick={openYears} className={`flex h-14 w-full items-center justify-between rounded-xl bg-[#f2f2f2] px-4 text-left ${formKid.birthYear ? "text-black" : "text-black/35"}`}><span>Birth year</span><span className="font-semibold text-black">{formKid.birthYear || "Choose"}</span></button><div className="flex h-14 w-full items-center gap-1 rounded-xl bg-[#f2f2f2] p-1" role="group" aria-label="Gender (optional)">{GENDERS.map((option) => { const selected = formKid.gender === option.id; const Icon = option.icon; return <button key={option.id} type="button" aria-pressed={selected} onClick={() => updateForm({ gender: selected ? null : option.id })} className={`flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors ${selected ? "bg-black text-white" : "text-black/40"}`}><Icon className="h-4 w-4" strokeWidth={2.25} />{option.label}</button>; })}</div></div>
          </div>
          {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          <div className="mt-auto pt-8">
            {screen === "onboarding" ? <><button type="button" disabled={saving || !formKid.birthYear} onClick={async () => { if (!valid()) return; const saved = await persist([...pendingKids, formKid]); if (saved) { router.replace("/"); router.refresh(); } }} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white disabled:bg-black/20">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Continue</button>{formKid.birthYear && pendingKids.length < 4 ? <button type="button" onClick={() => { if (!valid()) return; setPendingKids((items) => [...items, formKid]); setOnboardingKid(freshKid(pendingKids.length + 1)); }} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-black/15 text-sm font-semibold"><Plus className="h-4 w-4" /> Add another child</button> : <button type="button" disabled={saving} onClick={async () => { const saved = await persist([]); if (saved) { router.replace("/"); router.refresh(); } }} className="mt-2 h-12 w-full rounded-xl border border-black/15 text-sm font-semibold">Skip for now</button>}</> : confirmRemove ? <div className="rounded-2xl bg-red-50 p-4"><p className="text-sm font-semibold text-red-800">Remove {formKid.name || "this child"}?</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmRemove(false)} className="h-11 rounded-xl bg-white text-sm font-semibold">Cancel</button><button type="button" disabled={saving} onClick={() => void removeKid()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Remove</button></div></div> : <><button type="button" disabled={saving || !formKid.birthYear} onClick={() => void saveEdit()} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white disabled:bg-black/20">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{editIndex === null ? "Add child" : "Save changes"}</button>{editIndex !== null ? <button type="button" onClick={() => setConfirmRemove(true)} className="mt-2 flex h-12 w-full items-center justify-center gap-2 text-sm font-semibold text-red-600"><Trash2 className="h-4 w-4" /> Remove child</button> : null}</>}
          </div>
        </section> : null}
        </div>
      </div>

      {yearOpen && formKid ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-2" onPointerDown={(e) => { if (e.target === e.currentTarget) setYearOpen(false); }}><section role="dialog" aria-modal="true" aria-label="Choose birth year" className="mb-2 w-full max-w-[414px] rounded-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"><div className="flex items-center justify-between"><button type="button" aria-label="More recent years" disabled={!yearPage} onClick={() => setYearPage((page) => Math.max(0, page - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] disabled:opacity-25"><ChevronLeft className="h-5 w-5" /></button><h2 className="font-semibold">Birth year</h2><button type="button" aria-label="Close" onClick={() => setYearOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2]"><X className="h-5 w-5" /></button></div><div className="mt-5 grid grid-cols-3 gap-2">{years.map((item) => <button key={item} type="button" onClick={() => { updateForm({ birthYear: String(item) }); setYearOpen(false); }} className={`h-12 rounded-xl text-sm font-semibold ${formKid.birthYear === String(item) ? "bg-black text-white" : "bg-[#f2f2f2]"}`}>{item}</button>)}</div>{years.at(-1)! > 1920 ? <button type="button" onClick={() => setYearPage((page) => page + 1)} className="mt-3 flex h-11 w-full items-center justify-center gap-1 text-sm font-semibold text-black/50">Earlier <ChevronRight className="h-4 w-4" /></button> : null}</section></div> : null}
    </main>
  );
}
