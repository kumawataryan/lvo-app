"use client";

import { createContext, forwardRef, Fragment, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Bookmark, Check, ChevronDown, ChevronRight, CirclePlay, ClipboardList, Clock3, Compass, Download,  FastForward,  Folder, FolderPlus, Gem, GraduationCap, Hammer, Heart, House, Image as ImageIcon, LayoutGrid, LoaderCircle, Lock, LogOut, MoonStar, MoreHorizontal, Package, Palette, Pause, Pencil, Play, Plus, Printer, Puzzle, Quote,   Search, Share2, Shapes, SlidersHorizontal, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { AgeRangeSelector } from "@/components/age-range-selector";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "@/components/ui/toast";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { EmailIcon, EmailShareButton, FacebookIcon, FacebookShareButton, LinkedinIcon, LinkedinShareButton, PinterestIcon, PinterestShareButton, ThreadsIcon, ThreadsShareButton, TwitterIcon, TwitterShareButton, WhatsappIcon, WhatsappShareButton } from "react-share";
import { useReactToPrint } from "react-to-print";
import { fetchPublishedTemplates } from "@/lib/templates/client";
import { DEFAULT_TEMPLATE_CATEGORIES, type PublishedTemplate, type TemplateCategory } from "@/lib/templates/types";
import { embedFallbackRatio, parseVideoEmbedUrl } from "@/lib/templates/video-embed";
import { useEmbedPlayer } from "@/lib/video/use-embed-player";
import { useEmbedThumbnail } from "@/lib/video/use-embed-thumbnail";
import { PLAN_DETAILS } from "@/lib/payments/plans";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useStoryPlayer } from "@/components/story-player";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

export type Tab = "templates" | "browse" | "search" | "stories" | "products" | "profile";
export type Story = {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  palette: [string, string];
  accent: string;
  symbol: "moon" | "shapes" | "compass";
  lines: string[];
  scenes: string[];
  image?: string;
  sceneMedia?: Array<{ type: "image" | "video"; src: string }>;
  lyricsSrc?: string;
  audioSrc?: string;
};

export type TimedLyricLine = { time: number; text: string };

export const demoStories: Story[] = [
  {
    id: "tiny-explorer",
    title: "Nia’s Tiny Adventure",
    subtitle: "A big journey in the backyard",
    duration: 45,
    palette: ["#55321e", "#d9895b"],
    accent: "#ffe0ad",
    image: "/tiny-adventure.jpg",
    audioSrc: "/stories/tiny-explorer-narration.mp3",
    lyricsSrc: "/stories/tiny-explorer.lyrics.json",
    symbol: "compass",
    lines: [
      "Nia packed one snack and a very small map.",
      "The backyard, she decided, was really an entire jungle.",
      "A trail of ants led her beneath the tall sunflowers.",
      "\"Follow the leader,\" she whispered, tiptoeing behind them.",
      "The ants marched in a perfectly straight, busy little line.",
      "She crossed a pebble bridge over a silver puddle.",
      "A beetle waved two shiny antennae from a leaf.",
      "\"Good morning, explorer,\" it seemed to say.",
      "Nia marked the puddle on her map with a tiny star.",
      "The sunflowers swayed like giants bowing as she passed.",
      "She found a feather, a smooth stone, and a snail shell.",
      "Each one went carefully into her adventure pocket.",
      "Before dinner, the explorer found her way home.",
    ],
    scenes: ["Nia opens a map beside the sunflowers", "A tiny trail winds through the grass", "Pebbles become a brave explorer’s bridge", "Nia returns with a pocket full of stories"],
  },
];
type TemplateCollection = { id: string; name: string; templateIds: string[]; childAvatar?: string };
type TemplateCollectionRow = Omit<TemplateCollection, "templateIds"> & { template_collection_items: Array<{ template_id: string }> };
export const CHILD_AVATAR_SRC: Record<string, string> = {
  fox: "/avatars/avatar_01.png", bear: "/avatars/avatar_02.png", bunny: "/avatars/avatar_03.png",
  lion: "/avatars/avatar_04.png", panda: "/avatars/avatar_05.png", frog: "/avatars/avatar_06.png",
  koala: "/avatars/avatar_07.png", cat: "/avatars/avatar_08.png", dog: "/avatars/avatar_09.png",
  owl: "/avatars/avatar_10.png", unicorn: "/avatars/avatar_11.png", dino: "/avatars/avatar_12.png",
};
export type TemplateInteractions = {
  liked: Set<string>;
  saved: Set<string>;
  collections: TemplateCollection[];
  toggleLike: (templateId: string) => Promise<void>;
  saveToCollection: (templateId: string, options: { collectionId?: string; newName?: string }) => Promise<boolean>;
  removeSaved: (templateId: string) => Promise<boolean>;
  deleteCollection: (collectionId: string) => Promise<boolean>;
};

export type SubscriptionSummary = {
  planId: keyof typeof PLAN_DETAILS;
  billingType: "subscription" | "one_time";
  status: string;
  gateway: string;
  amount: number;
  currency: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};
export type ProfileKidSummary = { id: string; name: string; birthYear: number; avatar: string; gender: string | null };

function triggerHaptic(pattern: number | number[] = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

async function downloadTemplate(template: Template): Promise<boolean> {
  if (!template.hasPrintable) {
    window.alert("The printable file for this template is not available yet.");
    return false;
  }

  try {
    const linkResponse = await fetch(`/api/templates/${template.slug}/download`);
    const linkData = await linkResponse.json();
    if (linkResponse.status === 401) {
      window.location.href = "/login";
      return false;
    }
    if (!linkResponse.ok || !linkData.url) {
      window.alert(linkData.error || "The printable file could not be downloaded. Please try again.");
      return false;
    }

    const response = await fetch(linkData.url);
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

    const file = await response.blob();
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = typeof linkData.filename === "string" ? linkData.filename : `${template.slug}-template.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return true;
  } catch {
    window.alert("The printable file could not be downloaded. Please try again.");
    return false;
  }
}

async function loadPrintableTemplate(template: Template) {
  if (!template.hasPrintable) {
    throw new Error("The printable file for this template is not available yet.");
  }

  const linkResponse = await fetch(`/api/templates/${template.slug}/download`);
  const linkData = await linkResponse.json();
  if (linkResponse.status === 401) {
    window.location.href = "/login";
    return null;
  }
  if (!linkResponse.ok || !linkData.url) {
    throw new Error(linkData.error || "The printable file could not be opened. Please try again.");
  }

  const response = await fetch(linkData.url);
  if (!response.ok) throw new Error(`Printable request failed with status ${response.status}`);
  return response.blob();
}

async function printTemplate(template: Template) {
  try {
    const file = await loadPrintableTemplate(template);
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const objectUrl = URL.createObjectURL(file);
    const frame = document.createElement("iframe");
    frame.title = `Print ${template.name}`;
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.opacity = "0";
    document.body.appendChild(frame);

    await new Promise<void>((resolve, reject) => {
      const triggerPrint = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      if (isImage) {
        // A bare image loaded via `iframe.src` falls back to the browser's default
        // image-viewer document, which fits/zooms the image against the iframe's own
        // (intentionally 1px) on-screen viewport rather than the printed page size,
        // producing a badly scaled printout. An explicit page-fit stylesheet fixes it.
        const doc = frame.contentDocument;
        if (!doc) {
          reject(new Error("The printable file could not be rendered."));
          return;
        }
        doc.open();
        doc.write("<!DOCTYPE html><html><head><style>@page{margin:0}html,body{margin:0;padding:0;width:100%;height:100%}</style></head><body></body></html>");
        doc.close();
        const img = doc.createElement("img");
        img.alt = "";
        img.style.display = "block";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        img.onload = triggerPrint;
        img.onerror = () => reject(new Error("The printable file could not be rendered."));
        img.src = objectUrl;
        doc.body.appendChild(img);
      } else {
        frame.onload = triggerPrint;
        frame.onerror = () => reject(new Error("The printable file could not be rendered."));
        frame.src = objectUrl;
      }
    });

    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(objectUrl);
    }, 60_000);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "The printable file could not be printed. Please try again.");
  }
}

export type Template = {
  id: string;
  name: string;
  slug: string;
  category: string;
  categorySlug?: string;
  time: string;
  difficulty: "Easy" | "Medium" | "Advanced";
  supplies: string;
  description: string;
  videoSrc: string | null;
  videoEmbedUrl: string | null;
  thumbnailUrl: string | null;
  galleryImages: string[];
  galleryAltText: string[];
  supplyItems: Array<{ name: string; icon: string | null }>;
  tags: string[];
  hasPrintable: boolean;
  canPrint: boolean;
  isFree: boolean;
  minimumAge: number | null;
  maximumAge: number | null;
  palette?: [string, string, string];
  motif?: "flowers" | "lantern" | "origami" | "card" | "wreath" | "clay" | "vase" | "hanger";
};

export function mapPublishedTemplate(template: PublishedTemplate): Template {
  const difficulty = `${template.difficulty[0].toUpperCase()}${template.difficulty.slice(1)}` as Template["difficulty"];
  return {
    id: template.id,
    name: template.title,
    slug: template.slug,
    category: template.category.name,
    categorySlug: template.category.slug,
    time: `${template.durationMinutes} min`,
    difficulty,
    supplies: `${template.supplies.length} ${template.supplies.length === 1 ? "supply" : "supplies"}`,
    description: template.shortDescription,
    videoSrc: template.videoUrl,
    videoEmbedUrl: template.videoEmbedUrl,
    thumbnailUrl: template.thumbnailUrl,
    galleryImages: template.galleryImages.map((image) => image.url),
    galleryAltText: template.galleryImages.map((image) => image.altText),
    supplyItems: template.supplies.map((supply) => ({ name: supply.name, icon: supply.icon })),
    tags: template.tags ?? [],
    hasPrintable: template.hasPrintable,
    canPrint: template.hasPrintable && !template.printableIsZip,
    isFree: template.isFree,
    minimumAge: template.minimumAge,
    maximumAge: template.maximumAge,
  };
}

export function useTemplateInteractions(): TemplateInteractions {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [collections, setCollections] = useState<TemplateCollection[]>([]);

  const loadInteractions = async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser) {
      setLiked(new Set());
      setSaved(new Set());
      setCollections([]);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const [likesResult, collectionsResult, kidsResult] = await Promise.all([
      supabase.from("template_likes").select("template_id").eq("user_id", nextUser.id),
      supabase.from("template_collections").select("id, name, template_collection_items(template_id)").eq("user_id", nextUser.id).order("created_at"),
      supabase.from("kids").select("collection_id, avatar").eq("user_id", nextUser.id),
    ]);
    if (!likesResult.error) setLiked(new Set((likesResult.data ?? []).map((item: { template_id: string }) => item.template_id)));
    if (!collectionsResult.error) {
      const rows = (collectionsResult.data ?? []) as TemplateCollectionRow[];
      const childAvatarRows = (kidsResult.data ?? []) as Array<{ collection_id: string; avatar: string }>;
      const childAvatars = new Map<string, string>(childAvatarRows.map((kid) => [kid.collection_id, kid.avatar]));
      setCollections(rows
        .map(({ id, name, template_collection_items }) => ({ id, name, templateIds: template_collection_items.map((item) => item.template_id), childAvatar: childAvatars.get(id) }))
        .sort((a, b) => Number(Boolean(b.childAvatar)) - Number(Boolean(a.childAvatar))));
      setSaved(new Set(rows.flatMap((collection) => collection.template_collection_items.map((item) => item.template_id))));
    }
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => loadInteractions(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      window.setTimeout(() => void loadInteractions(session?.user ?? null), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const requireUser = () => {
    if (user) return user;
    router.push("/login");
    return null;
  };

  const toggleLike = async (templateId: string) => {
    const activeUser = requireUser();
    if (!activeUser) return;
    const wasLiked = liked.has(templateId);
    setLiked((current) => {
      const next = new Set(current);
      if (wasLiked) next.delete(templateId);
      else next.add(templateId);
      return next;
    });

    const supabase = createSupabaseBrowserClient();
    const { error } = wasLiked
      ? await supabase.from("template_likes").delete().eq("user_id", activeUser.id).eq("template_id", templateId)
      : await supabase.from("template_likes").insert({ user_id: activeUser.id, template_id: templateId });
    if (error) {
      setLiked((current) => {
        const next = new Set(current);
        if (wasLiked) next.add(templateId);
        else next.delete(templateId);
        return next;
      });
    }
  };

  const saveToCollection = async (templateId: string, options: { collectionId?: string; newName?: string }) => {
    const activeUser = requireUser();
    if (!activeUser) return false;
    const supabase = createSupabaseBrowserClient();
    let collectionId = options.collectionId;

    if (!collectionId) {
      const name = options.newName?.trim();
      if (!name) return false;
      const existing = collections.find((collection) => collection.name.toLowerCase() === name.toLowerCase());
      if (existing) collectionId = existing.id;
      else {
        const { data, error } = await supabase.from("template_collections").insert({ user_id: activeUser.id, name }).select("id, name").single();
        if (error || !data) return false;
        collectionId = data.id;
        setCollections((current) => [...current, { ...data, templateIds: [] }]);
      }
    }

    const { error } = await supabase.from("template_collection_items").upsert(
      { collection_id: collectionId, template_id: templateId },
      { onConflict: "collection_id,template_id", ignoreDuplicates: true },
    );
    if (error) return false;
    setSaved((current) => new Set(current).add(templateId));
    setCollections((current) => current.map((collection) => collection.id === collectionId && !collection.templateIds.includes(templateId)
      ? { ...collection, templateIds: [...collection.templateIds, templateId] }
      : collection));
    return true;
  };

  const removeSaved = async (templateId: string) => {
    const activeUser = requireUser();
    if (!activeUser) return false;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("template_collection_items").delete().eq("template_id", templateId);
    if (error) return false;
    setSaved((current) => {
      const next = new Set(current);
      next.delete(templateId);
      return next;
    });
    setCollections((current) => current.map((collection) => ({ ...collection, templateIds: collection.templateIds.filter((id) => id !== templateId) })));
    return true;
  };

  const deleteCollection = async (collectionId: string) => {
    const activeUser = requireUser();
    if (!activeUser) return false;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("delete_template_collection", { collection_id_input: collectionId });
    if (error) return false;
    const remaining = collections.filter((collection) => collection.id !== collectionId);
    setCollections(remaining);
    setSaved(new Set(remaining.flatMap((collection) => collection.templateIds)));
    return true;
  };

  return { liked, saved, collections, toggleLike, saveToCollection, removeSaved, deleteCollection };
}

type AppShellContextValue = {
  templates: Template[];
  templatesError: string | null;
  categories: TemplateCategory[];
  interactions: TemplateInteractions;
  subscribed: boolean;
  canAddTemplates: boolean;
  parentName: string;
  subscription: SubscriptionSummary | null;
  profileKids: ProfileKidSummary[];
  activeTab: Tab;
  goToTab: (tab: Tab) => void;
  openTemplate: (template: Template) => void;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) throw new Error("useAppShell must be used within AppShell");
  return context;
}

export const TAB_ROUTES: Partial<Record<Tab, string>> = {
  templates: "/",
  browse: "/browse",
  search: "/search",
  profile: "/profile",
  stories: "/stories",
};

export function tabRoute(tab: Tab): string {
  return TAB_ROUTES[tab] ?? "/";
}

function AppShell({ children, initialTemplates = [], initialCategories = DEFAULT_TEMPLATE_CATEGORIES, canAddTemplates = false, subscribed = false, parentName = "", subscription = null, profileKids = [] }: { children: ReactNode; initialTemplates?: PublishedTemplate[]; initialCategories?: TemplateCategory[]; canAddTemplates?: boolean; subscribed?: boolean; parentName?: string; subscription?: SubscriptionSummary | null; profileKids?: ProfileKidSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [templates, setTemplates] = useState<Template[]>(() => initialTemplates.map(mapPublishedTemplate));
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const player = useStoryPlayer();
  const storyDetailRef = useRef<StoryDetailHandle | null>(null);
  const interactions = useTemplateInteractions();
  const categories = (initialCategories.length ? initialCategories : DEFAULT_TEMPLATE_CATEGORIES)
    .filter((category) => category.slug !== "craft-classes" && category.slug !== "stories");

  useEffect(() => {
    if (initialTemplates.length) return;
    const controller = new AbortController();
    fetchPublishedTemplates(controller.signal)
      .then((items) => setTemplates(items.map(mapPublishedTemplate)))
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setTemplatesError("Unable to load templates.");
      });
    return () => controller.abort();
  }, [initialTemplates.length]);

  const openTemplate = (template: Template) => {
    router.push(`/t/${template.id}`);
  };

  const activeTab: Tab = pathname === "/browse" ? "browse" : pathname === "/search" ? "search" : pathname === "/profile" ? "profile" : "templates";

  const goToTab = (nextTab: Tab) => {
    const targetUrl = tabRoute(nextTab);
    const navigate = () => router.push(targetUrl);
    if (player.story) {
      player.setPlaying(false);
      if (!player.minimized) {
        const finish = () => { player.minimize(); navigate(); };
        if (storyDetailRef.current) storyDetailRef.current.minimize(finish);
        else finish();
        return;
      }
    }
    navigate();
  };

  const contextValue: AppShellContextValue = {
    templates, templatesError, categories, interactions, subscribed, canAddTemplates,
    parentName, subscription, profileKids, activeTab, goToTab, openTemplate,
  };

  return (
    <AppShellContext.Provider value={contextValue}>
      <main className="h-dvh w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <div className="relative isolate flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--background)]">
          {children}
        </div>

        {player.story && !player.minimized ? (
          <StoryDetail
            ref={storyDetailRef}
            story={player.story}
            progress={player.progress}
            playing={player.playing}
            onProgressChange={player.setProgress}
            onPlayingChange={player.setPlaying}
            onMinimize={() => { player.minimize(); router.push("/stories"); }}
          />
        ) : null}

        <BottomNav active={player.story && !player.minimized ? "stories" : activeTab} nowPlaying={player.story ? { story: player.story, progress: player.progress, playing: player.playing, onOpen: () => {
          const story = player.story!;
          if (player.minimized) {
            player.restore();
            router.push(`/stories/${story.id}`);
          } else if (storyDetailRef.current) {
            storyDetailRef.current.minimize();
          } else {
            player.minimize();
            router.push("/stories");
          }
        }, onTogglePlaying: () => player.setPlaying(!player.playing) } : undefined} onChange={goToTab} />
      </main>
    </AppShellContext.Provider>
  );
}

export function TemplatesTabContent() {
  const { templates, templatesError, subscribed, canAddTemplates, interactions, activeTab, goToTab, openTemplate } = useAppShell();
  return (
    <section className="m-0 flex min-h-0 flex-1 flex-col bg-white p-0">
      <TemplateTopBar canAddTemplates={canAddTemplates} subscribed={subscribed} activeCategory="" onCategoryChange={() => undefined} categoriesOverride={[]} activeTab={activeTab} onTabChange={goToTab} />
      {templatesError ? <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-black/50">{templatesError}</div> : <TemplateFeed templates={templates} onOpenDetail={openTemplate} subscribed={subscribed} interactions={interactions} />}
    </section>
  );
}

export function BrowseTabContent() {
  const { categories, canAddTemplates, subscribed, activeTab, goToTab } = useAppShell();
  const router = useRouter();
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <TemplateTopBar canAddTemplates={canAddTemplates} subscribed={subscribed} activeCategory="" onCategoryChange={() => undefined} categoriesOverride={[]} activeTab={activeTab} onTabChange={goToTab} />
      <div className="mx-auto min-h-0 w-full max-w-none flex-1 overflow-y-auto px-4 pb-28 pt-4 whitespace-nowrap min-[1033px]:max-w-3xl">
        <p className="mb-2.5 text-xs font-medium text-black/40">Categories</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                router.push(`/categories/${category.slug}`);
              }}
              className="flex min-h-14 items-center gap-2 rounded-2xl bg-[#f2f2f2] px-4 text-left text-[15px] font-semibold text-black transition hover:bg-[#e9e9e9] active:scale-[0.98]"
            >
              <span className="min-w-0 flex-1 truncate">{category.name}</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-black/30" strokeWidth={2} />
            </button>
          ))}
        </div>
        <p className="mb-2.5 mt-8 text-xs font-medium text-black/40">Special</p>
        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => router.push("/craft-classes")}
            className="flex h-14 items-center justify-between rounded-2xl bg-brand px-4 text-white transition hover:bg-brand/90 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <CirclePlay aria-hidden="true" className="h-5 w-5 text-white" strokeWidth={2.5} />
              <span className="text-[15px] font-semibold">Craft Classes</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-white/45" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => router.push("/stories")}
            className="flex h-14 items-center justify-between rounded-2xl bg-brand px-4 text-white transition hover:bg-brand/90 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <BookOpen aria-hidden="true" className="h-5 w-5 text-white" strokeWidth={2.25} />
              <span className="text-[15px] font-semibold">Stories</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-white/45" strokeWidth={2} />
          </button>
          <Link
            href="/games"
            className="flex h-14 items-center justify-between rounded-2xl bg-brand px-4 text-white transition hover:bg-brand/90 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <Puzzle aria-hidden="true" className="h-5 w-5 text-white" strokeWidth={2.25} />
              <span className="text-[15px] font-semibold">Games</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-white/45" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SearchTabContent({ initialQuery = "" }: { initialQuery?: string }) {
  const { templates, categories, subscribed, canAddTemplates, activeTab, goToTab, interactions, openTemplate } = useAppShell();
  return <SearchScreen templates={templates} categories={categories.slice(0, 5)} onOpenDetail={openTemplate} subscribed={subscribed} canAddTemplates={canAddTemplates} activeTab={activeTab} onTabChange={goToTab} interactions={interactions} initialQuery={initialQuery} />;
}

export function ProfileTabContent() {
  const { templates, interactions, subscribed, canAddTemplates, activeTab, goToTab, parentName, subscription, profileKids } = useAppShell();
  return <ProfileScreen templates={templates} interactions={interactions} subscribed={subscribed} canAddTemplates={canAddTemplates} activeTab={activeTab} onTabChange={goToTab} parentName={parentName} subscription={subscription} profileKids={profileKids} />;
}

export function StoriesScreen({ onOpenStory }: { onOpenStory: (story: Story) => void }) {
  const player = useStoryPlayer();

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden bg-white text-black">
      <div className="h-full overflow-y-auto pb-44 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-2 gap-2 px-2 pb-2 pt-5 sm:grid-cols-3 md:grid-cols-4 md:gap-3 md:px-3 lg:grid-cols-5 lg:gap-4 lg:px-4 xl:grid-cols-6 2xl:grid-cols-8">
          {demoStories.map((story) => {
            const isNowPlaying = player.story?.id === story.id;
            const fraction = isNowPlaying && story.duration > 0 ? Math.min(Math.max(player.progress / story.duration, 0), 1) : 0;
            return (
              <div
                key={story.id}
                role="button"
                tabIndex={0}
                onClick={() => { triggerHaptic(10); onOpenStory(story); }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  triggerHaptic(10);
                  onOpenStory(story);
                }}
                className="group relative aspect-[3/4] min-w-0 cursor-pointer overflow-hidden rounded-[18px] bg-[#202020] text-left text-white transition active:scale-[0.98]"
              >
                <StoryArtwork story={story} className="absolute inset-0" large />
                <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                {isNowPlaying ? (
                  <button
                    type="button"
                    aria-label={player.playing ? "Pause" : "Play"}
                    onClick={(event) => {
                      event.stopPropagation();
                      triggerHaptic(10);
                      player.setPlaying(!player.playing);
                    }}
                    className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition active:scale-90"
                  >
                    {player.playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
                  </button>
                ) : (
                  <span className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black">
                    <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
                  </span>
                )}
                <span className="absolute inset-x-3 bottom-3 min-w-0">
                  <span className="block truncate text-sm font-semibold">{story.title}</span>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-white/55"><Clock3 className="h-3 w-3" />{Math.ceil(story.duration / 60)} min</span>
                </span>
                {isNowPlaying ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/25">
                    <span className="block h-full bg-white transition-[width] duration-1000 ease-linear" style={{ width: `${fraction * 100}%` }} />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export type StoryDetailHandle = { minimize: (onDone?: () => void) => void };

export const StoryDetail = forwardRef<StoryDetailHandle, { story: Story; progress: number; playing: boolean; onProgressChange: (progress: number) => void; onPlayingChange: (playing: boolean) => void; onMinimize: () => void }>(function StoryDetail({ story, progress, playing, onProgressChange, onPlayingChange, onMinimize }, ref) {
  const [view, setView] = useState<"lyrics" | "carousel">("carousel");
  const [timedLyrics, setTimedLyrics] = useState<TimedLyricLine[] | null>(null);

  useEffect(() => {
    setView("carousel");
  }, [story]);

  useEffect(() => {
    setTimedLyrics(null);
    if (!story.lyricsSrc) return;
    const controller = new AbortController();
    fetch(story.lyricsSrc, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: TimedLyricLine[]) => setTimedLyrics(data))
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") console.error("Failed to load lyrics", error);
      });
    return () => controller.abort();
  }, [story]);

  const handleMinimize = () => onMinimize();

  useImperativeHandle(ref, () => ({ minimize: (onDone) => (onDone ?? onMinimize)() }));

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBackground = html.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.backgroundColor = "#000000";
    body.style.backgroundColor = "#000000";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.backgroundColor = previousHtmlBackground;
      body.style.backgroundColor = previousBodyBackground;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  const lines = timedLyrics ? timedLyrics.map((entry) => entry.text) : story.lines;
  const activeLine = timedLyrics
    ? Math.max(0, timedLyrics.findLastIndex((entry) => progress >= entry.time))
    : Math.min(Math.floor((progress / story.duration) * lines.length), lines.length - 1);
  const activeScene = Math.min(Math.floor((progress / story.duration) * story.scenes.length), story.scenes.length - 1);

  const handleLineTap = (index: number) => {
    if (index === activeLine) {
      onPlayingChange(!playing);
      return;
    }
    onProgressChange(timedLyrics ? timedLyrics[index].time : Math.floor((index / lines.length) * story.duration));
    onPlayingChange(true);
  };

  const actionButtonClass = "flex h-11 w-11 items-center justify-center rounded-xl bg-black/40 backdrop-blur-md transition active:scale-90";

  return (
    <div className="fixed inset-0 z-[2000] h-dvh w-full overflow-hidden bg-black text-white">
      <div className="relative mx-auto h-dvh w-full max-w-[430px] overflow-hidden bg-black">
      <StoryArtwork story={story} className={`absolute inset-0 transition-[filter] duration-500 ${view === "lyrics" ? "scale-110 blur-2xl" : ""}`} large scene={activeScene} />
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/50 to-transparent" aria-hidden="true" />

      <div className="relative flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between px-4 pt-4">
          <button type="button" aria-label="Minimize" onClick={handleMinimize} className={actionButtonClass}><ChevronDown className="h-5 w-5" /></button>
          <button
            type="button"
            aria-label={view === "lyrics" ? "Switch to gallery view" : "Switch to lyrics view"}
            onClick={() => setView((current) => (current === "lyrics" ? "carousel" : "lyrics"))}
            className={actionButtonClass}
          >
            {view === "lyrics" ? <ImageIcon className="h-5 w-5" /> : <Quote className="h-5 w-5" />}
          </button>
        </div>

        {view === "lyrics" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-5" aria-live="polite">
              {lines.map((line, index) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => handleLineTap(index)}
                  aria-label={index === activeLine ? (playing ? "Pause" : "Play") : "Jump to this line"}
                  className={`block w-full text-left text-2xl font-bold leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] transition-colors duration-500 ${index === activeLine ? "text-white" : "text-white/40"}`}
                >
                  {line}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {story.scenes.map((scene, index) => (
              <SceneMedia
                key={scene}
                story={story}
                index={index}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === activeScene ? "opacity-100" : "opacity-0"}`}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
});

function StoryArtwork({ story, className, large = false, scene = 0 }: { story: Story; className?: string; large?: boolean; scene?: number }) {
  if (story.image) {
    return (
      <span className={className}>
        <span className="relative block h-full w-full overflow-hidden">
          <Image src={story.image} alt="" fill sizes={large ? "430px" : "32px"} className="object-cover" />
        </span>
      </span>
    );
  }

  const Icon = story.symbol === "moon" ? MoonStar : story.symbol === "shapes" ? Shapes : Compass;
  return (
    <span className={className}>
      <span className="relative block h-full w-full overflow-hidden" style={{ background: `linear-gradient(${135 + scene * 18}deg, ${story.palette[0]}, ${story.palette[1]})` }}>
        <span className="absolute -right-[12%] -top-[18%] h-[70%] w-[70%] rounded-full bg-white/10" />
        <span className="absolute -bottom-[22%] -left-[12%] h-[65%] w-[65%] rounded-full bg-black/15" />
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: story.accent }}><Icon className={large ? "h-20 w-20" : "h-8 w-8"} strokeWidth={1.15} /></span>
        {large ? <span className="absolute left-[18%] top-[22%] h-2 w-2 rounded-full bg-white/60" /> : null}
        {large ? <span className="absolute right-[20%] top-[35%] h-1.5 w-1.5 rounded-full bg-white/45" /> : null}
      </span>
    </span>
  );
}

function SceneMedia({ story, index, className }: { story: Story; index: number; className: string }) {
  const media = story.sceneMedia?.[index];

  if (media?.type === "video") {
    return <video src={media.src} className={`${className} object-cover`} autoPlay muted loop playsInline preload="metadata" />;
  }

  if (media?.type === "image") {
    return (
      <span className={className}>
        <span className="relative block h-full w-full overflow-hidden">
          <Image src={media.src} alt="" fill sizes="430px" className="object-cover" />
        </span>
      </span>
    );
  }

  return <StoryArtwork story={story} className={className} large scene={index} />;
}

export function TemplateTopBar({ activeCategory, onCategoryChange, dark = false, canAddTemplates = false, subscribed = false, categoriesOverride, categoryOptions, activeTab, onTabChange, alwaysShowNav = false }: { activeCategory: string; onCategoryChange: (category: string) => void; dark?: boolean; canAddTemplates?: boolean; subscribed?: boolean; categoriesOverride?: string[]; categoryOptions?: TemplateCategory[]; activeTab?: Tab; onTabChange?: (tab: Tab) => void; alwaysShowNav?: boolean }) {
  const router = useRouter();
  const filterCategories = categoriesOverride ?? (categoryOptions ?? []).map((category) => category.name);
  const categoryIcons = new Map((categoryOptions ?? []).map((category) => [category.name, category.icon]));
  const desktopNavItems: { tab: Tab; label: string; icon: typeof Search }[] = [
    { tab: "search", label: "Search", icon: Search },
    { tab: "browse", label: "Category", icon: LayoutGrid },
    { tab: "profile", label: "Profile", icon: UserRound },
  ];

  return (
    <header className={`shrink-0 px-3 pb-3 pt-3 md:px-4 lg:px-5 ${dark ? "bg-brand text-white" : "bg-white text-black"}`}>
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            aria-label="Go to home"
            onClick={(event) => {
              if (!onTabChange || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onTabChange("templates");
            }}
            className="transition active:scale-95"
          >
            <Image src="/lovely-logo.png" alt="Lovely" width={400} height={126} priority className="h-8 w-auto" />
          </Link>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canAddTemplates ? (
            <button
              type="button"
              aria-label="Add template"
              onClick={() => router.push("/templates/new")}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f2f2f2] text-black transition active:scale-95 hover:bg-[#e9e9e9]"
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
            </button>
          ) : null}
          {onTabChange ? (
            <div className={`shrink-0 items-center gap-2 ${alwaysShowNav ? "flex" : "hidden min-[1033px]:flex"}`}>
              {desktopNavItems.filter(({ tab }) => tab !== "profile").map(({ tab, label, icon: Icon }) => (
                <button
                  key={tab}
                  type="button"
                  aria-label={label}
                  aria-current={activeTab === tab ? "page" : undefined}
                  onClick={() => onTabChange(tab)}
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl transition active:scale-95 ${activeTab === tab ? "bg-brand text-white" : "bg-[#f2f2f2] text-black hover:bg-[#e9e9e9]"}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} fill={activeTab === tab ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          ) : null}
          {subscribed ? null : (
            <button type="button" aria-label="Subscribe" onClick={() => router.push("/subscription")} className={`flex h-14 items-center gap-1.5 rounded-2xl px-4 text-xs font-medium shadow-[0_3px_10px_rgba(0,0,0,0.12)] transition active:scale-95 ${dark ? "bg-white text-black" : "bg-brand text-white"}`}>
              <SubscribeIcon />
              <span className="flex flex-col items-start leading-tight">
                <span>Subscribe</span>
                <span className={dark ? "text-[11px] text-black/55" : "text-[11px] text-white/65"}>{PLAN_DETAILS.monthly.price}/mo</span>
              </span>
            </button>
          )}
          {onTabChange ? (
            <div className={`shrink-0 items-center gap-2 ${alwaysShowNav ? "flex" : "hidden min-[1033px]:flex"}`}>
              {desktopNavItems.filter(({ tab }) => tab === "profile").map(({ tab, label, icon: Icon }) => (
                <button
                  key={tab}
                  type="button"
                  aria-label={label}
                  aria-current={activeTab === tab ? "page" : undefined}
                  onClick={() => onTabChange(tab)}
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl transition active:scale-95 ${activeTab === tab ? "bg-brand text-white" : "bg-[#f2f2f2] text-black hover:bg-[#e9e9e9]"}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} fill={activeTab === tab ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {categoryOptions?.length ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 md:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {categoryOptions.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={activeCategory === category.name}
              onClick={() => onCategoryChange(category.name)}
              className={`flex min-w-0 items-center gap-2 rounded-2xl p-2.5 text-left transition active:scale-[0.98] ${activeCategory === category.name ? "bg-brand text-white" : "bg-[#f2f2f2] text-black"}`}
            >
              <span className="flex h-9 w-7 shrink-0 items-center justify-center">
                <CategoryIcon icon={category.icon} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{category.name}</span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${activeCategory === category.name ? "text-white/55" : "text-black/30"}`} strokeWidth={2} />
            </button>
          ))}
        </div>
      ) : filterCategories.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {filterCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-[9px] text-[15px] font-medium backdrop-blur-xl transition active:scale-95 ${activeCategory === category ? (dark ? "bg-white/90 text-black" : "bg-black/85 text-white") : (dark ? "bg-white/20 text-white hover:bg-white/25" : "bg-black/[0.07] text-black/60 hover:bg-black/11")}`}
            >
              {category !== "All" ? <CategoryIcon icon={categoryIcons.get(category)} /> : null}
              {category}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}

export function CategoryDetailScreen({ category, subcategories, initialTemplates, subcategoryTemplates, subscribed = false }: { category: TemplateCategory; subcategories: TemplateCategory[]; initialTemplates: PublishedTemplate[]; subcategoryTemplates: Record<string, PublishedTemplate[]>; subscribed?: boolean }) {
  const router = useRouter();
  const templates = useMemo(() => initialTemplates.map(mapPublishedTemplate), [initialTemplates]);
  const templatesBySubcategory = useMemo(() => Object.fromEntries(
    Object.entries(subcategoryTemplates).map(([slug, items]) => [slug, items.map(mapPublishedTemplate)]),
  ), [subcategoryTemplates]);
  const [activeSubcategory, setActiveSubcategory] = useState<string>();
  const [ageMin, setAgeMin] = useState<number | null>(null);
  const [ageMax, setAgeMax] = useState<number | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const filtersActive = ageMin !== null || ageMax !== null || freeOnly;
  const visibleTemplates = useMemo(() => {
    const subcategoryTemplatesList = activeSubcategory ? templatesBySubcategory[activeSubcategory] ?? [] : templates;
    return subcategoryTemplatesList.filter((template) => {
      if (freeOnly && !template.isFree) return false;
      if (ageMax !== null && template.minimumAge !== null && ageMax < template.minimumAge) return false;
      if (ageMin !== null && template.maximumAge !== null && ageMin > template.maximumAge) return false;
      return true;
    });
  }, [activeSubcategory, templatesBySubcategory, templates, ageMin, ageMax, freeOnly]);
  const interactions = useTemplateInteractions();

  return (
    <main className="h-dvh w-full overflow-hidden bg-white text-black">
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex shrink-0 items-center gap-3 px-3 pb-2 pt-[calc(16px+env(safe-area-inset-top))] md:px-4 lg:px-5">
          <button type="button" aria-label="Back to categories" onClick={() => router.push("/browse")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2] transition active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{category.name}</h1>
          <button
            type="button"
            aria-label="Filters"
            aria-pressed={showFilters}
            onClick={() => setShowFilters(true)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-white transition active:scale-95"
          >
            <SlidersHorizontal className="h-4.5 w-4.5" />
            {filtersActive ? <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white" /> : null}
          </button>
        </div>
        {visibleTemplates.length ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {subcategories.length ? (
              <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-3 pt-3 md:px-4 lg:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  aria-pressed={!activeSubcategory}
                  onClick={() => setActiveSubcategory(undefined)}
                  className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-[15px] font-medium transition active:scale-95 ${!activeSubcategory ? "bg-black text-white" : "bg-black/[0.07] text-black/60"}`}
                >
                  All
                </button>
                {subcategories.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    type="button"
                    aria-pressed={activeSubcategory === subcategory.slug}
                    onClick={() => setActiveSubcategory((current) => current === subcategory.slug ? undefined : subcategory.slug)}
                    className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-[15px] font-medium transition active:scale-95 ${activeSubcategory === subcategory.slug ? "bg-black text-white" : "bg-black/[0.07] text-black/60"}`}
                  >
                    {subcategory.name}
                  </button>
                ))}
              </div>
            ) : null}
            <TemplateFeed templates={visibleTemplates} onOpenDetail={(template) => router.push(`/t/${template.id}`)} subscribed={subscribed} interactions={interactions} horizontalPadding="px-3 md:px-4 lg:px-5" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {subcategories.length ? (
              <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-3 pt-3 md:px-4 lg:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  aria-pressed={!activeSubcategory}
                  onClick={() => setActiveSubcategory(undefined)}
                  className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-[15px] font-medium transition active:scale-95 ${!activeSubcategory ? "bg-black text-white" : "bg-black/[0.07] text-black/60"}`}
                >
                  All
                </button>
                {subcategories.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    type="button"
                    aria-pressed={activeSubcategory === subcategory.slug}
                    onClick={() => setActiveSubcategory((current) => current === subcategory.slug ? undefined : subcategory.slug)}
                    className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-[15px] font-medium transition active:scale-95 ${activeSubcategory === subcategory.slug ? "bg-black text-white" : "bg-black/[0.07] text-black/60"}`}
                  >
                    {subcategory.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
              <p className="text-sm font-semibold">No templates {filtersActive ? "match your filters" : "yet"}</p>
              <p className="mt-1 text-sm text-black/40">{filtersActive ? "Try adjusting or clearing your filters." : "Check back soon."}</p>
              {filtersActive ? (
                <button type="button" onClick={() => { setAgeMin(null); setAgeMax(null); setFreeOnly(false); }} className="mt-5 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition active:scale-95">
                  Clear filters
                </button>
              ) : (
                <button type="button" onClick={() => router.push("/browse")} className="mt-5 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition active:scale-95">
                  Browse categories
                </button>
              )}
            </div>
          </div>
        )}
        <BottomNav active="browse" onChange={(tab) => router.push(tabRoute(tab))} />
      </div>
      {showFilters ? (
        <SearchFiltersSheet
          categories={[]}
          categoryFilter="All"
          onCategoryChange={() => undefined}
          ageMin={ageMin}
          ageMax={ageMax}
          onAgeRangeChange={(minimumAge, maximumAge) => { setAgeMin(minimumAge); setAgeMax(maximumAge); }}
          freeOnly={freeOnly}
          onFreeOnlyChange={setFreeOnly}
          onClose={() => setShowFilters(false)}
        />
      ) : null}
    </main>
  );
}

function SearchScreen({ templates, categories, onOpenDetail, subscribed, canAddTemplates, activeTab, onTabChange, interactions, initialQuery = "" }: { templates: Template[]; categories: TemplateCategory[]; onOpenDetail: (template: Template) => void; subscribed: boolean; canAddTemplates?: boolean; activeTab?: Tab; onTabChange?: (tab: Tab) => void; interactions: TemplateInteractions; initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery.slice(0, 80));
  const [serverSearch, setServerSearch] = useState<{ query: string; templates: Template[] } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [ageMin, setAgeMin] = useState<number | null>(null);
  const [ageMax, setAgeMax] = useState<number | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filtersActive = categoryFilter !== "All" || ageMin !== null || ageMax !== null || freeOnly;
  const isFiltering = query.trim().length > 0 || filtersActive;

  useEffect(() => {
    const search = query.trim();
    if (!search) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchPublishedTemplates(controller.signal, { search, limit: 24 })
        .then((items) => setServerSearch({ query: search.toLowerCase(), templates: items.map(mapPublishedTemplate) }))
        .catch((error: unknown) => {
          if ((error as { name?: string }).name !== "AbortError") setServerSearch({ query: search.toLowerCase(), templates: [] });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searchableTemplates = serverSearch?.query === q ? serverSearch.templates : templates;
    return searchableTemplates.filter((template) => {
      if (categoryFilter !== "All" && template.category !== categoryFilter) return false;
      if (freeOnly && !template.isFree) return false;
      if (ageMax !== null && template.minimumAge !== null && ageMax < template.minimumAge) return false;
      if (ageMin !== null && template.maximumAge !== null && ageMin > template.maximumAge) return false;
      if (q && serverSearch?.query !== q) {
        const searchableText = `${template.name} ${template.category} ${template.tags.join(" ")}`.toLowerCase();
        if (!q.split(/\s+/).every((term) => searchableText.includes(term))) return false;
      }
      return true;
    });
  }, [query, categoryFilter, ageMin, ageMax, freeOnly, serverSearch, templates]);

  const recentTemplates = useMemo(() => templates.slice(0, 20), [templates]);

  const desktopNavItems: { tab: Tab; label: string; icon: typeof Search }[] = [
    { tab: "browse", label: "Category", icon: LayoutGrid },
    { tab: "profile", label: "Profile", icon: UserRound },
  ];

  return (
    <section className="m-0 flex min-h-0 flex-1 flex-col bg-white p-0">
      <header className="shrink-0 px-3 pb-6 pt-3 md:px-4 lg:px-5">
        <div className="flex items-center gap-2">
          <div className="hidden shrink-0 items-center gap-2 min-[1033px]:flex">
            <Link
              href="/"
              aria-label="Go to home"
              onClick={(event) => {
                if (!onTabChange || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onTabChange("templates");
              }}
              className="transition active:scale-95"
            >
              <Image src="/lovely-logo.png" alt="Lovely" width={400} height={126} priority className="h-8 w-auto" />
            </Link>
          </div>

          <div className="flex min-w-0 flex-1 items-center">
            <label className="flex h-14 w-full min-w-0 items-center gap-2 rounded-2xl bg-[#f2f2f2] px-4 text-black">
              <Search className="h-4.5 w-4.5 shrink-0 text-black/45" />
              <input
                autoFocus
                suppressHydrationWarning
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates"
                aria-label="Search templates"
                className="min-w-0 flex-1 bg-transparent text-base text-black outline-none placeholder:text-black/40"
              />
              <button
                type="button"
                aria-label={query ? "Clear search" : "Cancel search"}
                onClick={() => (query ? setQuery("") : (onTabChange ? onTabChange("templates") : router.push("/")))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black/45 transition active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Search filters"
                aria-pressed={showFilters}
                onClick={() => setShowFilters(true)}
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition active:scale-90"
              >
                <SlidersHorizontal className="h-4.5 w-4.5" />
                {filtersActive ? <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white" /> : null}
              </button>
            </label>
          </div>

          <div className="hidden shrink-0 items-center gap-2 min-[1033px]:flex">
            {canAddTemplates ? (
              <button
                type="button"
                aria-label="Add template"
                onClick={() => router.push("/templates/new")}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f2f2f2] text-black transition active:scale-95 hover:bg-[#e9e9e9]"
              >
                <Plus className="h-5 w-5" strokeWidth={2.25} />
              </button>
            ) : null}
            {onTabChange ? (
              <div className="hidden shrink-0 items-center gap-2 min-[1033px]:flex">
                {desktopNavItems.filter(({ tab }) => tab !== "profile").map(({ tab, label, icon: Icon }) => (
                  <button
                    key={tab}
                    type="button"
                    aria-label={label}
                    aria-current={activeTab === tab ? "page" : undefined}
                    onClick={() => onTabChange(tab)}
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl transition active:scale-95 ${activeTab === tab ? "bg-brand text-white" : "bg-[#f2f2f2] text-black hover:bg-[#e9e9e9]"}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            ) : null}
            {subscribed ? null : (
              <button type="button" aria-label="Subscribe" onClick={() => router.push("/subscription")} className="flex h-14 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-brand px-4 text-xs font-medium text-white shadow-[0_3px_10px_rgba(0,0,0,0.12)] transition active:scale-95">
                <SubscribeIcon />
                <span className="flex flex-col items-start leading-tight">
                  <span>Subscribe</span>
                  <span className="text-[11px] text-white/65">{PLAN_DETAILS.monthly.price}/mo</span>
                </span>
              </button>
            )}
            {onTabChange ? (
              <div className="hidden shrink-0 items-center gap-2 min-[1033px]:flex">
                {desktopNavItems.filter(({ tab }) => tab === "profile").map(({ tab, label, icon: Icon }) => (
                  <button
                    key={tab}
                    type="button"
                    aria-label={label}
                    aria-current={activeTab === tab ? "page" : undefined}
                    onClick={() => onTabChange(tab)}
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl transition active:scale-95 ${activeTab === tab ? "bg-brand text-white" : "bg-[#f2f2f2] text-black hover:bg-[#e9e9e9]"}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <TemplateFeed templates={isFiltering ? results : recentTemplates} onOpenDetail={onOpenDetail} subscribed={subscribed} interactions={interactions} topPadding="pt-0" horizontalPadding="px-3 md:px-4 lg:px-5" />
      {showFilters ? (
        <SearchFiltersSheet
          categories={categories.map((category) => category.name)}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          ageMin={ageMin}
          ageMax={ageMax}
          onAgeRangeChange={(minimumAge, maximumAge) => { setAgeMin(minimumAge); setAgeMax(maximumAge); }}
          freeOnly={freeOnly}
          onFreeOnlyChange={setFreeOnly}
          onClose={() => setShowFilters(false)}
        />
      ) : null}
    </section>
  );
}

function SearchFiltersSheet({
  categories,
  categoryFilter,
  onCategoryChange,
  ageMin,
  ageMax,
  onAgeRangeChange,
  freeOnly,
  onFreeOnlyChange,
  onClose,
}: {
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (category: string) => void;
  ageMin: number | null;
  ageMax: number | null;
  onAgeRangeChange: (minimumAge: number | null, maximumAge: number | null) => void;
  freeOnly: boolean;
  onFreeOnlyChange: (value: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent widthClassName="max-w-none">
        <div className="mx-auto w-full max-w-none min-[1033px]:max-w-3xl">
          <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/15" />
          <DrawerTitle className="text-lg font-semibold tracking-tight">Filters</DrawerTitle>
          <DrawerDescription className="sr-only">Filter templates by category, age range, and free access.</DrawerDescription>
          {categories.length ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Category</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onCategoryChange(categoryFilter === category ? "All" : category)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${categoryFilter === category ? "bg-black text-white" : "bg-black/[0.05] text-black/60 hover:bg-black/[0.08]"}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Age range</p>
            <AgeRangeSelector className="mt-2.5" minimumAge={ageMin} maximumAge={ageMax} onChange={onAgeRangeChange} allowClear />
          </div>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Access</p>
            <button type="button" aria-pressed={freeOnly} onClick={() => onFreeOnlyChange(!freeOnly)} className={`mt-2.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${freeOnly ? "bg-black text-white" : "bg-black/[0.05] text-black/60 hover:bg-black/[0.08]"}`}>
              Free
            </button>
          </div>
          <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.98]">Show results</button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function TemplateFeed(props: {
  dark?: boolean;
  templates: Template[];
  onOpenDetail: (template: Template) => void;
  subscribed: boolean;
  interactions: TemplateInteractions;
  topPadding?: string;
  horizontalPadding?: string;
}) {
  const { templates, dark = false, topPadding = "pt-3", horizontalPadding = "px-3 md:px-4 lg:px-5" } = props;

  return (
    <div className={`relative m-0 h-full overscroll-y-contain ${horizontalPadding} pb-24 ${topPadding} overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${dark ? "bg-black" : "bg-white"}`}>
      <div className="columns-2 gap-5 sm:columns-3 md:gap-6 lg:columns-4 min-[1033px]:columns-5 xl:columns-6 2xl:columns-8">
        {templates.map((template, index) => (
          <div key={template.id} className="mb-5 break-inside-avoid md:mb-6">
            <TemplateCard
              template={template}
              eager={index < 9}
              onOpenDetail={() => props.onOpenDetail(template)}
              interactions={props.interactions}
              subscribed={props.subscribed}
            />
          </div>
        ))}
      </div>
      {templates.length === 0 ? <div className="flex min-h-48 items-center justify-center px-8 text-center text-sm text-black/45">No templates match your search.</div> : null}
    </div>
  );
}

export function TemplateCard({
  template,
  onOpenDetail,
  interactions,
  subscribed = false,
  statusIcon,
  eager = false,
}: {
  template: Template;
  onOpenDetail?: () => void;
  interactions: TemplateInteractions;
  subscribed?: boolean;
  statusIcon?: "like" | "save";
  eager?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelAnchorRef = useRef<HTMLButtonElement | null>(null);
  const printContentRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<"save" | "share" | null>(null);
  const [cardFeedback, setCardFeedback] = useState<{ action: "like" | "save"; active: boolean; nonce: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [subscriptionPrompt, setSubscriptionPrompt] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hasVideo = Boolean(template.videoSrc) || Boolean(template.videoEmbedUrl);
  const liked = interactions.liked.has(template.id);
  const saved = interactions.saved.has(template.id);
  const canDownload = subscribed || template.isFree;

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  const runPrint = useReactToPrint({
    contentRef: printContentRef,
    documentTitle: () => `${template.slug}-template`,
    print: async () => { await printTemplate(template); },
    onAfterPrint: () => setPrinting(false),
    onPrintError: () => setPrinting(false),
  });

  const showFeedback = (action: "like" | "save", active: boolean) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setCardFeedback({ action, active, nonce: Date.now() });
    feedbackTimerRef.current = setTimeout(() => setCardFeedback(null), 900);
  };

  const handleLike = () => {
    triggerHaptic(10);
    showFeedback("like", !liked);
    void interactions.toggleLike(template.id);
  };

  const handleDownload = () => {
    if (!canDownload) {
      setSubscriptionPrompt(true);
      return;
    }
    if (downloading) return;
    setDownloading(true);
    void downloadTemplate(template).finally(() => setDownloading(false));
  };

  const handlePrint = () => {
    if (!canDownload) {
      setSubscriptionPrompt(true);
      return;
    }
    if (printing) return;
    setPrinting(true);
    runPrint();
  };

  const quickActions = (
    <>
          <button type="button" aria-label="Download" onClick={() => { handleDownload(); setMenuOpen(false); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition active:scale-90 hover:bg-white/15">{downloading ? <LoaderCircle className="h-5.5 w-5.5 animate-spin" /> : <Download className="h-5.5 w-5.5" />}</button>
          {template.canPrint ? <button type="button" aria-label="Print" onClick={() => { handlePrint(); setMenuOpen(false); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition active:scale-90 hover:bg-white/15">{printing ? <LoaderCircle className="h-5.5 w-5.5 animate-spin" /> : <Printer className="h-5.5 w-5.5" />}</button> : null}
          <button type="button" aria-label={liked ? "Unlike" : "Like"} onClick={() => { handleLike(); setMenuOpen(false); }} className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-90 hover:bg-white/15 ${liked ? "text-red-500" : "text-white"}`}><Heart className="h-5.5 w-5.5" fill={liked ? "currentColor" : "none"} /></button>
          <button type="button" aria-label="Share" onClick={(event) => { panelAnchorRef.current = event.currentTarget.closest(".template-card-desktop-actions") ? event.currentTarget : triggerRef.current; setMenuOpen(false); setPanel("share"); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition active:scale-90 hover:bg-white/15"><Share2 className="h-5.5 w-5.5" /></button>
          <button type="button" aria-label="Save" onClick={(event) => { panelAnchorRef.current = event.currentTarget.closest(".template-card-desktop-actions") ? event.currentTarget : triggerRef.current; setMenuOpen(false); setPanel("save"); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition active:scale-90 hover:bg-white/15"><Bookmark className="h-5.5 w-5.5" fill={saved ? "currentColor" : "none"} /></button>
    </>
  );

  return (
    <article
      className={`template-card relative m-0 w-full cursor-pointer touch-manipulation overflow-hidden rounded-[22px] bg-[#f2eee8] p-0 ${hasVideo ? "aspect-[9/16]" : "ring-1 ring-black/10"}`}
      onContextMenu={(event) => event.preventDefault()}
      onClick={onOpenDetail}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
    >
      <ReelMedia template={template} eager={eager} hovered={hovered} />
      {statusIcon ? (
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md">
          {statusIcon === "like" ? <Heart className="h-4 w-4" fill="currentColor" /> : <Bookmark className="h-4 w-4" fill="currentColor" />}
        </span>
      ) : null}
      {cardFeedback ? (
        <span key={cardFeedback.nonce} aria-live="polite" aria-label={cardFeedback.active ? (cardFeedback.action === "like" ? "Liked" : "Saved") : (cardFeedback.action === "like" ? "Like removed" : "Removed from saved")} className="card-action-feedback pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="flex items-center justify-center text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.7)]">
            {cardFeedback.action === "like" ? <Heart className="h-8 w-8" fill={cardFeedback.active ? "currentColor" : "none"} strokeWidth={2.2} /> : <Bookmark className="h-8 w-8" fill={cardFeedback.active ? "currentColor" : "none"} strokeWidth={2.2} />}
          </span>
        </span>
      ) : null}
      {downloading ? (
        <span aria-live="polite" aria-label="Downloading template" className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/45 backdrop-blur-[2px]">
          <LoaderCircle className="h-8 w-8 animate-spin text-white" strokeWidth={2.2} />
          <span className="text-[11px] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">Downloading…</span>
        </span>
      ) : null}

      <div
        className="template-card-desktop-actions absolute top-2 right-2 z-20 max-h-[calc(100%-1rem)] flex-col items-center gap-2 [&>button]:min-h-6 [&>button]:bg-black/20 [&>button]:backdrop-blur-xl [&>button:hover]:bg-black/30"
        onClick={(event) => event.stopPropagation()}
      >
        {quickActions}
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-label={menuOpen ? `Close quick actions for ${template.name}` : `Quick actions for ${template.name}`}
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className="template-card-actions-trigger absolute bottom-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition active:scale-90"
      >
        {menuOpen ? <X className="h-5 w-5" strokeWidth={2.2} /> : <MoreHorizontal className="h-5 w-5" strokeWidth={2.2} />}
      </button>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverContent
          anchor={triggerRef}
          side="top"
          align="end"
          sideOffset={8}
          className="flex w-auto min-w-0 flex-col gap-1.5 rounded-2xl bg-black/35 p-1.5 shadow-none backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
        >
          {quickActions}
        </PopoverContent>
      </Popover>

      <Popover open={panel === "save"} onOpenChange={(open) => setPanel(open ? "save" : null)}>
        <PopoverContent anchor={panelAnchorRef} align="end" onClick={(event) => event.stopPropagation()}>
          <SaveToCollectionOptions
            template={template}
            interactions={interactions}
            onClose={() => setPanel(null)}
            onChange={(active) => showFeedback("save", active)}
            renderTitle={(title) => <PopoverTitle>{title}</PopoverTitle>}
            compact
          />
        </PopoverContent>
      </Popover>

      <Popover open={panel === "share"} onOpenChange={(open) => setPanel(open ? "share" : null)}>
        <PopoverContent anchor={panelAnchorRef} align="end" onClick={(event) => event.stopPropagation()}>
          <PopoverTitle>Share template</PopoverTitle>
          <PopoverDescription className="sr-only">Choose where to share {template.name}.</PopoverDescription>
          <ShareOptionsGrid template={template} onClose={() => setPanel(null)} />
        </PopoverContent>
      </Popover>

      {subscriptionPrompt ? <SubscriptionSheet template={template} onClose={() => setSubscriptionPrompt(false)} /> : null}
      <div ref={printContentRef} className="hidden" aria-hidden="true" />
    </article>
  );
}

function SubscriptionSheet({ template, onClose }: { template: Template; onClose: () => void }) {
  const router = useRouter();
  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent>
        <DrawerTitle className="text-xl font-semibold tracking-tight">Unlock printable</DrawerTitle>
        <DrawerDescription className="sr-only">Subscribe to download {template.name}.</DrawerDescription>
        <p className="mt-1 text-sm font-medium text-black/45">$1.50 / month</p>
        <button type="button" onClick={() => { onClose(); router.push(`/subscription?template=${template.slug}`); }} className="mt-5 h-12 w-full rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.98]">Continue</button>
      </DrawerContent>
    </Drawer>
  );
}

function SaveToCollectionOptions({ template, interactions, onClose, onChange, renderTitle, compact = false }: { template: Template; interactions: TemplateInteractions; onClose: () => void; onChange?: (active: boolean) => void; renderTitle?: (title: string) => ReactNode; compact?: boolean }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarSize = compact ? 28 : 36;

  const saveToCollection = async (options: { collectionId?: string; newName?: string }) => {
    setSaving(true);
    const newName = options.newName?.trim() ?? "";
    const collectionName = options.collectionId
      ? interactions.collections.find((collection) => collection.id === options.collectionId)?.name
      : interactions.collections.find((collection) => collection.name.toLowerCase() === newName.toLowerCase())?.name ?? newName;
    const saved = await interactions.saveToCollection(template.id, options);
    setSaving(false);
    if (saved) {
      toast.add({ title: collectionName ? `Saved to ${collectionName}` : "Saved to collection", data: { image: template.thumbnailUrl ?? template.galleryImages[0] } });
      onChange?.(true);
      onClose();
    }
  };

  const removeSaved = async () => {
    setSaving(true);
    const collectionNames = interactions.collections.filter((collection) => collection.templateIds.includes(template.id)).map((collection) => collection.name).join(", ");
    const removed = await interactions.removeSaved(template.id);
    setSaving(false);
    if (removed) {
      toast.add({ title: collectionNames ? `Removed from ${collectionNames}` : "Removed from collection", data: { image: template.thumbnailUrl ?? template.galleryImages[0] } });
      onChange?.(false);
      onClose();
    }
  };

  const title = creating ? "New collection" : "Save to collection";

  return (
    <div>
      <div className="flex items-center gap-2">
        {creating ? <button type="button" aria-label="Back" onClick={() => setCreating(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05]"><ArrowLeft className="h-4 w-4" /></button> : null}
        {renderTitle ? renderTitle(title) : <span className="text-lg font-semibold tracking-tight">{title}</span>}
      </div>
      {creating ? (
        <div className={`space-y-3 ${compact ? "mt-2" : "mt-4"}`}>
          <input id="quick-collection-name" aria-label="Collection name" autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) void saveToCollection({ newName: name }); }} placeholder="Collection name" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition focus:ring-2" />
          <button type="button" disabled={!name.trim() || saving} onClick={() => void saveToCollection({ newName: name })} className="h-12 w-full rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-black/15">{saving ? "Saving…" : "Create and save"}</button>
        </div>
      ) : (
        <div className={compact ? "mt-2 space-y-1.5" : "mt-4 space-y-2"}>
          <button type="button" onClick={() => setCreating(true)} className={`flex w-full items-center gap-3 rounded-xl bg-black text-left text-sm font-semibold text-white transition active:scale-[0.99] ${compact ? "px-3 py-2.5" : "px-4 py-3.5"}`}><FolderPlus className="h-5 w-5" /> New collection</button>
          <div className={compact ? "max-h-64 space-y-1.5 overflow-y-auto" : "space-y-2"}>
            {interactions.collections.map((collection) => (
              <button key={collection.id} type="button" disabled={saving} onClick={() => void saveToCollection({ collectionId: collection.id })} className={`flex w-full items-center gap-3 rounded-xl bg-[#f2f2f2] text-left text-sm font-medium text-black/75 transition active:scale-[0.99] disabled:opacity-50 ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
                {collection.childAvatar && CHILD_AVATAR_SRC[collection.childAvatar]
                  ? <Image src={CHILD_AVATAR_SRC[collection.childAvatar]} alt="" width={avatarSize} height={avatarSize} className={`shrink-0 rounded-full object-cover ${compact ? "h-7 w-7" : "h-9 w-9"}`} />
                  : <span className={`flex shrink-0 items-center justify-center rounded-full bg-white ${compact ? "h-7 w-7" : "h-9 w-9"}`}><Folder className="h-4 w-4 text-black/40" /></span>}
                <span className="min-w-0 truncate">{collection.name}</span>
              </button>
            ))}
            {interactions.saved.has(template.id) ? <button type="button" disabled={saving} onClick={() => void removeSaved()} className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium text-black/45 transition active:scale-[0.99] disabled:opacity-50">Remove from saved</button> : null}
          </div>
        </div>
      )}
    </div>
  );
}

const DISCOVERY_GRID_SIZE = 36;
const DISCOVERY_PLACEHOLDER_RATIOS = ["aspect-[4/5]", "aspect-square", "aspect-[3/4]", "aspect-[5/6]"];

function DiscoveryPlaceholderCard({ variant }: { variant: number }) {
  return <div className={`w-full ${DISCOVERY_PLACEHOLDER_RATIOS[variant % DISCOVERY_PLACEHOLDER_RATIOS.length]} animate-pulse rounded-[22px] bg-[#f2f2f2]`} aria-hidden="true" />;
}

const MASONRY_BREAKPOINTS: Array<{ min: number; columns: number }> = [
  { min: 0, columns: 2 },
  { min: 640, columns: 3 },
  { min: 1024, columns: 4 },
  { min: 1033, columns: 5 },
  { min: 1280, columns: 6 },
  { min: 1536, columns: 8 },
];
const MASONRY_GAP = 20;

function useMasonryColumns() {
  const [columns, setColumns] = useState(MASONRY_BREAKPOINTS[0].columns);
  useEffect(() => {
    const compute = () => {
      const width = window.innerWidth;
      let value = MASONRY_BREAKPOINTS[0].columns;
      for (const breakpoint of MASONRY_BREAKPOINTS) if (width >= breakpoint.min) value = breakpoint.columns;
      setColumns(value);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return columns;
}

type MasonryTile = { key: string; span: number; render: ReactNode };

// Real (JS-packed) masonry, not CSS columns: needed so the first tile can span
// multiple columns while the rest keep flowing into whichever column is shortest,
// Pinterest-style. CSS multi-column layout can't do a partial column span.
function MasonryGrid({ tiles }: { tiles: MasonryTile[] }) {
  const columns = useMasonryColumns();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; width: number }>>(new Map());
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const columnWidth = columns > 0 && containerWidth > 0 ? (containerWidth - MASONRY_GAP * (columns - 1)) / columns : 0;

  const recompute = useCallback(() => {
    if (!columnWidth) return;
    const columnHeights = new Array(columns).fill(0);
    const next = new Map<string, { x: number; y: number; width: number }>();

    for (const tile of tiles) {
      const span = Math.max(1, Math.min(tile.span, columns));
      const el = itemElsRef.current.get(tile.key);
      const measuredHeight = el?.getBoundingClientRect().height || columnWidth;

      let bestStart = 0;
      let bestMax = Infinity;
      for (let start = 0; start <= columns - span; start++) {
        let maxInRange = 0;
        for (let i = start; i < start + span; i++) maxInRange = Math.max(maxInRange, columnHeights[i]);
        if (maxInRange < bestMax) { bestMax = maxInRange; bestStart = start; }
      }

      next.set(tile.key, { x: bestStart * (columnWidth + MASONRY_GAP), y: bestMax, width: span * columnWidth + (span - 1) * MASONRY_GAP });
      const newHeight = bestMax + measuredHeight + MASONRY_GAP;
      for (let i = bestStart; i < bestStart + span; i++) columnHeights[i] = newHeight;
    }

    setPositions(next);
    setHeight(Math.max(0, ...columnHeights) - MASONRY_GAP);
  }, [tiles, columns, columnWidth]);

  useEffect(() => { recompute(); }, [recompute]);

  useEffect(() => {
    const observers = Array.from(itemElsRef.current.values()).map((el) => {
      const observer = new ResizeObserver(() => recompute());
      observer.observe(el);
      return observer;
    });
    return () => observers.forEach((observer) => observer.disconnect());
  }, [recompute]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: height || undefined }}>
      {tiles.map((tile) => {
        const pos = positions.get(tile.key);
        const span = Math.max(1, Math.min(tile.span, columns));
        const fallbackWidth = span * columnWidth + (span - 1) * MASONRY_GAP;
        return (
          <div
            key={tile.key}
            ref={(el) => { if (el) itemElsRef.current.set(tile.key, el); else itemElsRef.current.delete(tile.key); }}
            className="absolute left-0 top-0"
            style={{
              width: pos?.width ?? fallbackWidth,
              transform: `translate(${pos?.x ?? 0}px, ${pos?.y ?? 0}px)`,
              opacity: pos ? 1 : 0,
              transition: "transform 200ms ease, opacity 200ms ease",
            }}
          >
            {tile.render}
          </div>
        );
      })}
    </div>
  );
}

export function TemplateDetail({ template, related, onBack, subscribed = false, canAddTemplates = false, interactions, categoryTrail = null }: { template: Template; related: Template[]; onBack: () => void; subscribed?: boolean; canAddTemplates?: boolean; interactions: TemplateInteractions; categoryTrail?: { category: TemplateCategory; parent: TemplateCategory | null } | null }) {
  const router = useRouter();
  const [heartBurst, setHeartBurst] = useState(false);
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [savePopoverOpen, setSavePopoverOpen] = useState(false);
  const [gatheredSupplies, setGatheredSupplies] = useState<Set<string>>(new Set());
  const [galleryTemplate, setGalleryTemplate] = useState<Template | null>(null);
  // Replays a one-shot icon animation: the nonce changes on every trigger so the icon remounts.
  const [iconAnimation, setIconAnimation] = useState<{ action: "like" | "share" | "save"; nonce: number } | null>(null);
  const animateIcon = (action: "like" | "share" | "save") => setIconAnimation({ action, nonce: Date.now() });
  const iconAnimationKey = (action: "like" | "share" | "save") => (iconAnimation?.action === action ? iconAnimation.nonce : 0);
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [printing, setPrinting] = useState(false);
  const detailPrintContentRef = useRef<HTMLDivElement>(null);

  const runDetailPrint = useReactToPrint({
    contentRef: detailPrintContentRef,
    documentTitle: () => `${template.slug}-template`,
    print: async () => { await printTemplate(template); },
    onAfterPrint: () => setPrinting(false),
    onPrintError: () => setPrinting(false),
  });

  const liked = interactions.liked.has(template.id);
  const saved = interactions.saved.has(template.id);
  const canDownload = subscribed || template.isFree;

  const requestDownload = () => {
    if (!canDownload) {
      router.push(`/subscription?template=${template.slug}`);
      return;
    }
    if (downloading) return;
    setDownloading(true);
    void downloadTemplate(template)
      .then((started) => {
        if (!started) return;
        toast.add({ title: "Download started", data: { image: template.thumbnailUrl ?? template.galleryImages[0] } });
        setDownloadDone(true);
        window.setTimeout(() => setDownloadDone(false), 2500);
      })
      .finally(() => setDownloading(false));
  };

  const requestPrint = () => {
    if (!canDownload) {
      router.push(`/subscription?template=${template.slug}`);
      return;
    }
    if (printing) return;
    setPrinting(true);
    runDetailPrint();
  };

  const handleDoubleTap = () => {
    void interactions.toggleLike(template.id);
    setHeartBurst(true);
    triggerHaptic([10, 25, 14]);
    window.setTimeout(() => setHeartBurst(false), 850);
  };

  const discoverySlots: Array<Template | null> = related.length >= DISCOVERY_GRID_SIZE
    ? related
    : [...related, ...Array.from({ length: DISCOVERY_GRID_SIZE - related.length }, () => null)];

  const photos = template.galleryImages;
  const heroMedia = (
    <section
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button, input")) return;
        handleDoubleTap();
      }}
      className="relative w-full touch-manipulation select-none overflow-hidden rounded-2xl"
    >
      <DetailVideoPlayer
        key={template.id}
        template={template}
        active
        mobileOverlay={
          <div className="max-h-[24dvh] w-full overflow-y-auto text-white">
            <h1 className="text-base font-semibold leading-5">{template.name}</h1>
            <DetailDescription description={template.description} tags={[]} overlay />
          </div>
        }
      />
      {heartBurst ? (
        <div className="heart-burst pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <Heart fill="currentColor" strokeWidth={1.5} />
        </div>
      ) : null}
    </section>
  );

  const suppliesSection = template.supplyItems.length ? (
    <section className="min-w-0 overflow-hidden rounded-2xl bg-white border border-black/10">
                  <h2 className="flex items-center gap-2 border-b border-black/10 px-3 pb-1 pt-3 text-[13px] min-[900px]:px-4 min-[900px]:py-2.5 min-[900px]:text-[15px] font-semibold">
                    <Package className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />What you’ll need
                  </h2>
                  <table className="w-full table-fixed border-collapse text-sm min-[900px]:table-auto">
                    <tbody className="divide-y divide-black/[0.08]">
                      {template.supplyItems.map((supply, index) => {
                        const ready = gatheredSupplies.has(supply.name);
                        const toggle = () => setGatheredSupplies((current) => {
                          const next = new Set(current);
                          if (next.has(supply.name)) next.delete(supply.name);
                          else next.add(supply.name);
                          return next;
                        });
                        return (
                          <tr key={supply.name} onClick={toggle} className="cursor-pointer transition hover:bg-[#f7f7f7] active:bg-[#f2f2f2]">
                            <td className="w-9 py-1.5 text-center align-middle border-r border-black/[0.08]">
                              <button type="button" role="checkbox" aria-checked={ready} aria-label={`${supply.name}, item ${index + 1}`} className="inline-flex h-5 w-5 touch-manipulation items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-brand">
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition ${ready ? "bg-brand text-white" : "bg-[#f2f2f2] text-black/45"}`}>
                                  {ready ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                                </span>
                              </button>
                            </td>
                            <td className={`break-words px-3 py-1.5 text-xs leading-5 min-[900px]:px-3 min-[900px]:text-sm transition ${ready ? "text-black/35 line-through" : "text-black/80"}`}>{supply.name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
  ) : null;

  const tiles: MasonryTile[] = [
    {
      key: template.id,
      span: 4,
      render: (
        <div className="flex w-full flex-col gap-1.5 min-[900px]:gap-3">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-2xl bg-white min-[900px]:border min-[900px]:border-black/10 min-[900px]:grid-cols-2 min-[900px]:grid-rows-[auto_1fr]">
          <div className={`relative z-30 col-start-1 row-start-1 m-3 flex flex-col items-end gap-2 p-0 self-start justify-self-end min-[900px]:z-auto min-[900px]:col-start-2 min-[900px]:row-start-1 min-[900px]:m-0 min-[900px]:grid min-[900px]:auto-cols-fr min-[900px]:grid-flow-col min-[900px]:gap-2 min-[900px]:self-stretch min-[900px]:justify-self-stretch min-[900px]:px-4 min-[900px]:pb-0 min-[900px]:pt-4`}>
            <div className="flex flex-col gap-2 min-[900px]:hidden">
              <button type="button" aria-label="Download" title="Download" onClick={requestDownload} disabled={downloading} aria-busy={downloading} className="flex h-14 w-14 touch-manipulation items-center justify-center rounded-2xl bg-brand text-white transition active:scale-95 hover:bg-brand/90 disabled:opacity-70">
                {downloading ? <LoaderCircle className="h-6 w-6 animate-spin" /> : downloadDone ? <Check className="h-6 w-6" /> : <Download className="h-6 w-6" />}
              </button>
              {template.canPrint ? (
                <button type="button" aria-label="Print" title="Print" onClick={requestPrint} disabled={printing} aria-busy={printing} className="flex h-14 w-14 touch-manipulation items-center justify-center rounded-2xl bg-white text-black transition active:scale-95 hover:bg-[#f2f2f2] disabled:opacity-70">
                  {printing ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Printer className="h-6 w-6" />}
                </button>
              ) : null}
            </div>
            <div role="separator" className="my-1 mr-2 h-px w-10 bg-white/50 min-[900px]:hidden" />
            <button type="button" aria-label="Like" aria-pressed={liked} onClick={() => { animateIcon("like"); triggerHaptic(12); void interactions.toggleLike(template.id); }} className={`group flex h-14 w-14 shrink-0 min-w-0 touch-manipulation select-none min-[900px]:flex-row min-[900px]:gap-0 min-[900px]:h-20 min-[900px]:w-auto items-center justify-center rounded-2xl cursor-pointer transition active:scale-90 active:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black min-[900px]:active:scale-[0.98] min-[900px]:active:bg-transparent min-[900px]:focus-visible:outline-black bg-black/20 backdrop-blur-xl hover:bg-black/30 min-[900px]:bg-[#f2f2f2] min-[900px]:hover:bg-[#e9e9e9] min-[900px]:backdrop-blur-none ${liked ? "text-red-500" : "text-white min-[900px]:text-black/75"}`}>
              <Heart key={iconAnimationKey("like")} className={`h-6 w-6 stroke-2 min-[900px]:stroke-[1.7] min-[900px]:h-9 min-[900px]:w-9 transition-transform duration-200 group-hover:scale-110 ${iconAnimation?.action === "like" && liked ? "animate-icon-pop" : ""}`} fill={liked ? "currentColor" : "none"} strokeWidth={1.7} />
            </button>

            <Popover open={sharePopoverOpen} onOpenChange={setSharePopoverOpen}>
              <PopoverTrigger aria-label="Share" onClick={() => { animateIcon("share"); triggerHaptic(12); }} className="group flex h-14 w-14 shrink-0 min-w-0 touch-manipulation select-none min-[900px]:flex-row min-[900px]:gap-0 min-[900px]:h-20 min-[900px]:w-auto items-center justify-center rounded-2xl cursor-pointer transition active:scale-90 active:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black min-[900px]:active:scale-[0.98] min-[900px]:active:bg-transparent min-[900px]:focus-visible:outline-black text-white min-[900px]:text-black/75 bg-black/20 backdrop-blur-xl hover:bg-black/30 min-[900px]:bg-[#f2f2f2] min-[900px]:hover:bg-[#e9e9e9] min-[900px]:backdrop-blur-none">
                <Share2 key={iconAnimationKey("share")} className={`h-6 w-6 stroke-2 min-[900px]:stroke-[1.7] min-[900px]:h-9 min-[900px]:w-9 transition-transform duration-200 group-hover:scale-110 ${iconAnimation?.action === "share" ? "animate-icon-wiggle" : ""}`} strokeWidth={1.7} />
              </PopoverTrigger>
              <PopoverContent>
                <PopoverTitle>Share template</PopoverTitle>
                <PopoverDescription className="sr-only">Choose where to share {template.name}.</PopoverDescription>
                <ShareOptionsGrid template={template} onClose={() => setSharePopoverOpen(false)} />
              </PopoverContent>
            </Popover>


            <Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
              <PopoverTrigger aria-label="Save" onClick={() => triggerHaptic(12)} className={`group flex h-14 w-14 min-[900px]:ml-0 min-[900px]:px-0 shrink-0 min-w-0 touch-manipulation select-none min-[900px]:flex-row min-[900px]:gap-0 min-[900px]:h-20 min-[900px]:w-auto items-center justify-center rounded-2xl cursor-pointer transition active:scale-90 active:bg-brand/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black min-[900px]:active:scale-[0.98] min-[900px]:active:bg-transparent min-[900px]:focus-visible:outline-black bg-black/20 text-white backdrop-blur-xl hover:bg-black/30 min-[900px]:backdrop-blur-none ${saved ? "min-[900px]:text-black min-[900px]:bg-[#e9e9e9] min-[900px]:hover:bg-[#dedede]" : "min-[900px]:text-black/75 min-[900px]:bg-[#f2f2f2] min-[900px]:hover:bg-[#e9e9e9]"}`}>
                <Bookmark key={iconAnimationKey("save")} className={`h-6 w-6 text-white min-[900px]:text-inherit stroke-2 min-[900px]:stroke-[1.7] min-[900px]:h-9 min-[900px]:w-9 transition-transform duration-200 group-hover:scale-110 ${iconAnimation?.action === "save" && saved ? "animate-icon-pop" : ""}`} fill={saved ? "currentColor" : "none"} strokeWidth={1.7} />
              </PopoverTrigger>
              <PopoverContent>
                <SaveToCollectionOptions
                  template={template}
                  interactions={interactions}
                  onClose={() => setSavePopoverOpen(false)}
                  onChange={(active) => { if (active) animateIcon("save"); }}
                  renderTitle={(title) => <PopoverTitle>{title}</PopoverTitle>}
                  compact
                />
              </PopoverContent>
            </Popover>


          </div>

          <div className="relative col-start-1 row-start-1 w-full overflow-hidden rounded-2xl bg-[#f2f2f2] min-[900px]:col-start-1 min-[900px]:row-start-1 min-[900px]:row-span-2">
            {heroMedia}
            {photos.length ? (
              <button
                type="button"
                aria-label={`View gallery, ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
                title="View gallery"
                onClick={() => setGalleryTemplate(template)}
                className="absolute bottom-28 right-3 z-20 h-14 w-14 touch-manipulation rounded-2xl transition active:scale-95 min-[900px]:hidden"
              >
                {photos.slice(0, 3).reverse().map((src, index, images) => {
                  const depth = images.length - 1 - index;
                  return (
                    <span
                      key={`${src}-${index}`}
                      className="absolute bottom-0 right-0 h-[52px] w-[52px] overflow-hidden rounded-xl"
                      style={{ transform: `translate(${-depth * 2}px, ${-depth * 2}px)` }}
                    >
                      <Image src={src} alt="" fill sizes="52px" className="object-cover" />
                    </span>
                  );
                })}
                {photos.length > 1 ? <span className="absolute bottom-0 right-0 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-black/35 text-sm font-semibold text-white">+{photos.length - 1}</span> : null}
              </button>
            ) : null}




            <button type="button" aria-label="Back" onClick={onBack} className="absolute left-3 top-3 z-20 flex h-14 w-14 min-[900px]:left-4 min-[900px]:top-4 items-center justify-center rounded-2xl bg-black/20 text-white backdrop-blur-xl transition active:scale-95 hover:bg-black/30"><ArrowLeft className="h-7 w-7 min-[900px]:h-6 min-[900px]:w-6" /></button>
          </div>

          <div className={`row-start-2 hidden min-w-0 flex-col gap-2 p-3 min-[900px]:flex min-[900px]:bg-white min-[900px]:col-start-2 min-[900px]:row-start-2 min-[900px]:gap-6 min-[900px]:p-4 min-[900px]:pt-6`}>
            <div className="flex flex-col gap-2 min-[900px]:gap-5">
              <div className="hidden min-[900px]:block">
                {template.categorySlug ? (
                  <nav aria-label="Category" className="hidden min-[900px]:inline-flex h-8 min-[900px]:mb-3 min-[900px]:h-9 items-stretch divide-x divide-white/20 overflow-hidden rounded-xl bg-brand text-xs font-semibold text-white min-[900px]:text-sm">
                    {categoryTrail?.parent ? (
                      <Link href={`/categories/${categoryTrail.parent.slug}`} aria-label={`Browse ${categoryTrail.parent.name}`} className="inline-flex h-full items-center gap-2 px-3 transition hover:bg-white/15 active:bg-white/25">
                        <CategoryIcon icon={categoryTrail.parent.icon} className="h-4 w-4 shrink-0" />{categoryTrail.parent.name}
                      </Link>
                    ) : null}
                    <Link href={`/categories/${template.categorySlug}`} aria-label={`Browse ${template.category}`} className={`inline-flex h-full items-center gap-2 px-3 transition hover:bg-white/15 active:bg-white/25 ${categoryTrail?.parent ? "text-white/85" : ""}`}>
                      {categoryTrail?.parent ? null : <CategoryIcon icon={categoryTrail?.category.icon} className="h-4 w-4 shrink-0" />}{template.category}
                    </Link>
                  </nav>
                ) : null}
                <h1 className="text-balance text-lg min-[900px]:text-[27px] font-semibold leading-tight tracking-tight">{template.name}</h1>
                <DetailDescription description={template.description} tags={template.tags} />
              </div>
            {photos.length ? (
              <button
                type="button"
                aria-label={`View gallery, ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
                title="View gallery"
                onClick={() => setGalleryTemplate(template)}
                className="relative hidden h-14 w-14 shrink-0 touch-manipulation rounded-2xl transition active:scale-95 min-[900px]:block"
              >
                {photos.slice(0, 3).reverse().map((src, index, images) => {
                  const depth = images.length - 1 - index;
                  return (
                    <span
                      key={`${src}-${index}`}
                      className="absolute bottom-0 right-0 h-[52px] w-[52px] overflow-hidden rounded-xl"
                      style={{ transform: `translate(${-depth * 2}px, ${-depth * 2}px)` }}
                    >
                      <Image src={src} alt="" fill sizes="52px" className="object-cover" />
                    </span>
                  );
                })}
                {photos.length > 1 ? <span className="absolute bottom-0 right-0 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-black/35 text-sm font-semibold text-white">+{photos.length - 1}</span> : null}
              </button>
            ) : null}
              {suppliesSection ? <div className="hidden min-[900px]:block">{suppliesSection}</div> : null}
            </div>

            <div className="mt-auto hidden flex-col gap-2 min-[900px]:flex">
              <div className="grid auto-cols-fr grid-flow-col gap-2">
                <button type="button" onClick={requestDownload} disabled={downloading} aria-busy={downloading} className="group flex h-14 min-w-0 flex-row min-[900px]:h-24 min-[900px]:flex-col items-center justify-center gap-2 rounded-2xl bg-brand text-[13px] font-semibold text-white transition active:scale-95 hover:bg-brand/85 disabled:opacity-70">
                  {downloading ? <LoaderCircle className="h-5 w-5 min-[900px]:h-8 min-[900px]:w-8 animate-spin" strokeWidth={1.8} /> : downloadDone ? <Check className="h-5 w-5 min-[900px]:h-8 min-[900px]:w-8 animate-icon-pop" strokeWidth={2.5} /> : canDownload ? <Download className="h-5 w-5 min-[900px]:h-8 min-[900px]:w-8 animate-icon-bob" strokeWidth={1.8} /> : <Lock className="h-5 w-5 min-[900px]:h-8 min-[900px]:w-8" strokeWidth={1.8} />}
                  {downloading ? "Getting it ready…" : downloadDone ? "Done!" : "Download"}
                </button>
                {template.canPrint ? (
                  <button type="button" onClick={requestPrint} disabled={printing} aria-busy={printing} className="group flex h-14 min-w-0 flex-row min-[900px]:h-24 min-[900px]:flex-col items-center justify-center gap-2 rounded-2xl bg-[#f2f2f2] text-[13px] font-semibold text-black transition active:scale-95 hover:bg-[#e9e9e9] disabled:opacity-70">
                    {printing ? <LoaderCircle className="h-5 w-5 min-[900px]:h-8 min-[900px]:w-8 animate-spin" strokeWidth={1.8} /> : canDownload ? <Printer className="h-5 w-5 min-[900px]:h-8 min-[900px]:w-8 transition group-hover:scale-110" strokeWidth={1.8} /> : <Lock className="h-5 w-5 min-[900px]:h-8 min-[900px]:w-8" strokeWidth={1.8} />}
                    {printing ? "Getting it ready…" : "Print"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {suppliesSection ? <div className="mb-4 w-full min-[900px]:hidden">{suppliesSection}</div> : null}
        </div>
      ),
    },
    ...discoverySlots.map((item, index): MasonryTile => ({
      key: item?.id ?? `placeholder-${index}`,
      span: 1,
      render: item ? (
        <TemplateCard template={item} onOpenDetail={() => router.push(`/t/${item.id}`)} interactions={interactions} subscribed={subscribed} />
      ) : (
        <DiscoveryPlaceholderCard variant={index} />
      ),
    })),
  ];

  return (
    <main className="fixed inset-0 flex w-screen max-w-none flex-col bg-white text-black">
      <div className="hidden shrink-0 md:block">
        <TemplateTopBar canAddTemplates={canAddTemplates} subscribed={subscribed} activeCategory="" onCategoryChange={() => undefined} categoriesOverride={[]} onTabChange={(tab) => router.push(tabRoute(tab))} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-full px-3 pb-10 pt-2 md:px-5 md:pb-16 lg:px-6">
          <MasonryGrid tiles={tiles} />
        </div>
      </div>

      <div ref={detailPrintContentRef} className="hidden" aria-hidden="true" />
      {galleryTemplate ? <TemplateGallery template={galleryTemplate} onClose={() => setGalleryTemplate(null)} /> : null}
    </main>
  );
}

const COLLAPSED_DESCRIPTION_LINES = 3;
const COLLAPSED_TAG_COUNT = 4;

type DescriptionSearch = { count: number; lo: number; hi: number; done: boolean };

const tagHref = (tag: string) => `/tags/${tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function DetailDescription({ description, tags, overlay = false }: { description: string; tags: string[]; overlay?: boolean }) {
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [width, setWidth] = useState(0);
  const tokens = useMemo(() => description.split(/\s+/).filter(Boolean), [description]);
  const [search, setSearch] = useState<DescriptionSearch>({ count: tokens.length, lo: 0, hi: tokens.length, done: false });

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      setWidth((current) => (current === next ? current : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Restart the fit search whenever the content or the available width change.
  useLayoutEffect(() => {
    setSearch({ count: tokens.length, lo: 0, hi: tokens.length, done: false });
  }, [tokens, width]);

  // Collapsed: binary-search the most words/tags that still leave "… See more" inside the line limit.
  useLayoutEffect(() => {
    if (expanded || search.done) return;
    const container = textRef.current;
    const toggle = toggleRef.current;
    if (!container || !toggle) return;
    const lineHeight = Number.parseFloat(window.getComputedStyle(container).lineHeight);
    const overflows = toggle.getBoundingClientRect().top - container.getBoundingClientRect().top >= lineHeight * (overlay ? 1 : COLLAPSED_DESCRIPTION_LINES);
    const lo = overflows ? search.lo : search.count;
    const hi = overflows ? search.count - 1 : search.hi;
    if (lo >= hi || hi < 0) setSearch({ count: Math.max(0, lo), lo, hi: lo, done: true });
    else setSearch({ count: Math.ceil((lo + hi) / 2), lo, hi, done: false });
  }, [expanded, search, overlay]);

  if (!tokens.length && !tags.length) return null;
  const truncated = search.count < tokens.length;
  const showToggle = tokens.length > 0 && (expanded || !search.done || truncated);
  return (
    <div className={overlay ? "mt-0.5" : "mt-1.5"}>
      {tokens.length ? (
        <p ref={textRef} className={overlay ? "text-[11px] leading-[15px] text-white/90" : "text-xs leading-4 min-[900px]:text-base min-[900px]:leading-6 text-black/65"}>
          {expanded ? <span className="whitespace-pre-line">{description}</span> : tokens.slice(0, search.count).join(" ")}
          {!expanded && truncated ? "… " : " "}
          {showToggle ? <button ref={toggleRef} type="button" onClick={() => setExpanded((current) => !current)} className={`font-semibold ${overlay ? "text-[11px] text-white" : "text-xs min-[900px]:text-base text-black"}`}>{expanded ? "Show less" : "Read more"}</button> : null}
        </p>
      ) : null}
      {tags.length ? (
        <div className={`flex flex-wrap gap-2 ${tokens.length ? "mt-2 min-[900px]:mt-4" : ""}`}>
          {(tagsExpanded ? tags : tags.slice(0, COLLAPSED_TAG_COUNT)).map((tag) => <Link key={tag} href={tagHref(tag)} className="rounded-lg bg-white min-[900px]:bg-[#f2f2f2] px-2.5 py-1 text-xs font-medium text-black/70 transition hover:bg-[#e9e9e9]">#{tag.replace(/\s+/g, "")}</Link>)}
          {tags.length > COLLAPSED_TAG_COUNT ? (
            <button type="button" onClick={() => setTagsExpanded((current) => !current)} className="rounded-lg bg-white min-[900px]:bg-[#f2f2f2] min-[900px]:border min-[900px]:border-black/10 px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-[#f2f2f2]">
              {tagsExpanded ? "Show less" : `+${tags.length - COLLAPSED_TAG_COUNT} more`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ShareOptionsGrid({ template, onClose }: { template: Template; onClose: () => void }) {
  const url = typeof window === "undefined" ? `/t/${template.id}` : window.location.href;
  const title = `Make ${template.name} with Lovely Vibes Only.`;

  const shareToInstagram = async () => {
    if (navigator.share) {
      await navigator.share({ title: template.name, text: `${title} ${url}` }).catch(() => undefined);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => undefined);
    }
    onClose();
  };

  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-4">
      <ShareOption label="WhatsApp">
        <WhatsappShareButton url={url} title={title} aria-label="Share on WhatsApp"><WhatsappIcon size={42} round /></WhatsappShareButton>
      </ShareOption>
      <ShareOption label="Facebook">
        <FacebookShareButton url={url} hashtag="#LVOCrafts" aria-label="Share on Facebook"><FacebookIcon size={42} round /></FacebookShareButton>
      </ShareOption>
      <ShareOption label="Twitter">
        <TwitterShareButton url={url} title={title} aria-label="Share on Twitter"><TwitterIcon size={42} round /></TwitterShareButton>
      </ShareOption>
      <ShareOption label="LinkedIn">
        <LinkedinShareButton url={url} title={template.name} summary={title} aria-label="Share on LinkedIn"><LinkedinIcon size={42} round /></LinkedinShareButton>
      </ShareOption>
      <ShareOption label="Threads">
        <ThreadsShareButton url={url} title={title} aria-label="Share on Threads"><ThreadsIcon size={42} round /></ThreadsShareButton>
      </ShareOption>
      <ShareOption label="Instagram">
        <button type="button" aria-label="Share on Instagram" onClick={shareToInstagram} className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white"><Share2 className="h-5 w-5" /></button>
      </ShareOption>
      <ShareOption label="Pinterest">
        <PinterestShareButton url={url} media={url} description={title} aria-label="Share on Pinterest"><PinterestIcon size={42} round /></PinterestShareButton>
      </ShareOption>
      <ShareOption label="Email">
        <EmailShareButton url={url} subject={template.name} body={title} aria-label="Share by email"><EmailIcon size={42} round /></EmailShareButton>
      </ShareOption>
    </div>
  );
}

function ShareOption({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center text-[11px] font-medium text-black/58">
      {children}
      <span>{label}</span>
    </div>
  );
}

export function BottomNav({ active, onChange, nowPlaying }: { active: Tab; onChange: (tab: Tab) => void; nowPlaying?: { story: Story; progress: number; playing: boolean; onOpen: () => void; onTogglePlaying: () => void } }) {
  const dark = active === "stories";
  const items: { tab: Tab; label: string; icon: NavIconName }[] = [
    { tab: "templates", label: "Templates", icon: "templates" },
    { tab: "browse", label: "Category", icon: "browse" },
    { tab: "search", label: "Search", icon: "search" },
    // { tab: "products", label: "Products", icon: "products" },
    { tab: "profile", label: "Profile", icon: "profile" },
  ];

  return (
        <nav className="mobile-nav" aria-label="Main navigation">
      <div className="mx-auto flex w-auto items-center justify-center gap-2">
        {items.map((item) => {
          const isNowPlaying = item.tab === "stories" && nowPlaying && active === "stories";
          const itemClassName = `pointer-events-auto flex h-14 w-14 flex-none cursor-pointer touch-manipulation select-none items-center justify-center overflow-hidden rounded-2xl bg-black/35 px-0 text-white shadow-[0_4px_14px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all ${active === item.tab ? "scale-105" : "opacity-90 hover:opacity-100"}`;

          if (isNowPlaying) {
            return (
              <div
                key={item.tab}
                id="story-nav-anchor"
                role="button"
                tabIndex={0}
                onClick={() => { triggerHaptic(10); nowPlaying.onOpen(); }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  triggerHaptic(10);
                  nowPlaying.onOpen();
                }}
                aria-label={`Open ${nowPlaying.story.title}`}
                aria-current={active === item.tab ? "page" : undefined}
                className={itemClassName}
              >
                <StoryThumbnailIcon
                  story={nowPlaying.story}
                  progress={nowPlaying.progress}
                  playing={nowPlaying.playing}
                  dark={dark}
                  onTogglePlaying={() => {
                    triggerHaptic(10);
                    nowPlaying.onTogglePlaying();
                  }}
                />
              </div>
            );
          }

          return (
            <button
              key={item.tab}
              onClick={() => {
                triggerHaptic(10);
                onChange(item.tab);
              }}
              type="button"
              aria-label={item.label}
              aria-current={active === item.tab ? "page" : undefined}
              className={itemClassName}
            >
              <NavIcon name={item.icon} active={active === item.tab} dark={dark} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

type NavIconName = "templates" | "browse" | "search" | "stories" | "products" | "profile";

function NavIcon({ name, active, dark }: { name: NavIconName; active: boolean; dark: boolean }) {
  const Icon = name === "templates"
    ? House
    : name === "browse"
      ? LayoutGrid
      : name === "search"
        ? Search
      : name === "stories"
        ? MoonStar
      : name === "products"
          ? Shapes
          : UserRound;

  return <Icon aria-hidden="true" className="h-6 w-6 text-white" fill={active ? "currentColor" : "none"} strokeWidth={1.8} />;
}

function StoryThumbnailIcon({ story, progress, playing, dark, onTogglePlaying }: { story: Story; progress: number; playing: boolean; dark: boolean; onTogglePlaying: () => void }) {
  const size = 32;
  const strokeWidth = 2;
  const cornerRadius = 9;
  const color = "#ffffff";
  const track = "rgba(255,255,255,0.3)";
  const fraction = story.duration > 0 ? Math.min(Math.max(progress / story.duration, 0), 1) : 0;

  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ height: size, width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden="true">
        <rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={size - strokeWidth}
          height={size - strokeWidth}
          rx={cornerRadius}
          fill="none"
          stroke={track}
          strokeWidth={strokeWidth}
        />
        <rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={size - strokeWidth}
          height={size - strokeWidth}
          rx={cornerRadius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - fraction * 100}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="relative h-7 w-7 overflow-hidden rounded-lg">
        <StoryArtwork story={story} className="absolute inset-0" />
        <span className="absolute inset-0 bg-black/25" aria-hidden="true" />
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePlaying();
          }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-black">
            {playing ? <Pause className="h-2.5 w-2.5" fill="currentColor" /> : <Play className="ml-0.5 h-2.5 w-2.5" fill="currentColor" />}
          </span>
        </button>
      </span>
    </span>
  );
}

function ProfileScreen({ templates, interactions, subscribed = false, canAddTemplates = false, activeTab, onTabChange, parentName = "", subscription = null, profileKids = [] }: { templates: Template[]; interactions: TemplateInteractions; subscribed?: boolean; canAddTemplates?: boolean; activeTab?: Tab; onTabChange?: (tab: Tab) => void; parentName?: string; subscription?: SubscriptionSummary | null; profileKids?: ProfileKidSummary[] }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>();
  const savedTemplates = templates.filter((template) => interactions.saved.has(template.id));
  const likedTemplates = templates.filter((template) => interactions.liked.has(template.id));
  const collectionCount = interactions.collections.filter((collection) => collection.templateIds.length > 0).length;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then((result: { data: { user: User | null } }) => {
      if (result.data.user) setUser(result.data.user);
      else router.replace("/login");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (nextSession?.user) setUser(nextSession.user);
      else router.replace("/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  if (!user) return <section className="h-full bg-white" aria-label="Loading profile" />;

  const displayName = parentName || (typeof user.user_metadata.full_name === "string"
    ? user.user_metadata.full_name
    : typeof user.user_metadata.name === "string"
      ? user.user_metadata.name
      : user.email?.split("@")[0] || "Your account");
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  const subscriptionPlan = subscription ? PLAN_DETAILS[subscription.planId] : null;
  const subscriptionDate = subscription?.currentPeriodEnd
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(subscription.currentPeriodEnd))
    : null;
  const subscriptionAmount = subscription
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: subscription.currency, maximumFractionDigits: 2 }).format(subscription.amount / 100)
    : null;
  const subscriptionStatus = subscription?.cancelAtPeriodEnd
    ? subscriptionDate ? `Ending · ${subscriptionDate}` : "Ending"
    : subscription?.status === "completed" && subscription.billingType === "one_time"
      ? "Lifetime"
      : subscription ? subscriptionDate ? `Active · Renews ${subscriptionDate}` : "Active" : "Inactive";
  const subscriptionStatusTone = !subscription
    ? "bg-black/[0.06] text-black/45"
    : subscription.cancelAtPeriodEnd
      ? "bg-red-100 text-red-700"
      : subscription.billingType === "one_time"
        ? "bg-blue-100 text-blue-700"
        : "bg-emerald-100 text-emerald-700";

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <section className="flex h-full w-full flex-col bg-white text-black">
      <TemplateTopBar canAddTemplates={canAddTemplates} subscribed={subscribed} activeCategory="" onCategoryChange={() => undefined} categoriesOverride={[]} activeTab={activeTab} onTabChange={onTabChange} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-2">
      <div className="mx-auto mt-4 w-full max-w-none whitespace-nowrap min-[1033px]:max-w-3xl">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div aria-hidden="true" className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand text-xl font-semibold text-white">{initials || "U"}</div>
          {subscribed ? (
            <button type="button" aria-label="Manage subscription" onClick={() => router.push("/subscription/manage")} className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#f2f2f2] text-black transition active:scale-90">
              <Gem className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{displayName}</h1>
          <p className="mt-1 truncate text-sm text-black/48">{user.email}</p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <button type="button" onClick={() => router.push(subscribed ? "/subscription/manage" : "/subscription")} className="flex w-full items-start gap-3 rounded-2xl bg-[#f2f2f2] p-4 text-left transition active:scale-[0.98]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white"><Gem className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{subscriptionPlan ? `${subscriptionPlan.name} plan` : "Subscription"}</span><span className={`rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${subscriptionStatusTone}`}>{subscriptionStatus}</span></span>
            {subscription ? <span className="mt-1 block text-xs font-medium text-black/60">{subscriptionAmount} · {subscriptionPlan?.period}</span> : <span className="mt-1 block text-xs text-black/45">Choose a plan to unlock all templates</span>}
          </span>
          <ChevronRight className="mt-3.5 h-4 w-4 shrink-0 text-black/30" />
        </button>
        <button type="button" onClick={() => router.push("/onboarding")} className="flex w-full items-center gap-3 rounded-2xl bg-[#f2f2f2] p-4 text-left transition active:scale-[0.98]">
          {profileKids.length ? <span className="flex shrink-0 -space-x-2">{profileKids.slice(0, 3).map((kid) => <Image key={kid.id} src={CHILD_AVATAR_SRC[kid.avatar] ?? "/avatars/avatar_01.png"} alt="" width={40} height={40} className="h-10 w-10 rounded-full border-2 border-[#f2f2f2] object-cover" />)}{profileKids.length > 3 ? <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f2f2f2] bg-black text-[10px] font-semibold text-white">+{profileKids.length - 3}</span> : null}</span> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white"><UserRound className="h-5 w-5" /></span>}
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Manage kids</span><span className="mt-1 block truncate text-xs text-black/45">{profileKids.length ? profileKids.map((kid) => kid.name).join(", ") : "No kids added"}</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-black/30" />
        </button>
        {canAddTemplates ? (
          <button type="button" onClick={() => router.push("/templates/manage")} className="flex w-full items-center gap-3 rounded-2xl bg-[#f2f2f2] p-4 text-left transition active:scale-[0.98]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white"><LayoutGrid className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Manage templates</span><span className="mt-1 block truncate text-xs text-black/45">Edit templates you&apos;ve added</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-black/30" />
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        <div className="flex gap-10 border-b border-black/[0.08]">
          <button type="button" aria-current="page" className="flex h-10 w-32 items-center justify-start gap-1.5 border-b-2 border-brand px-1 text-left text-sm font-medium text-brand">
            <Bookmark className="h-4 w-4" fill="currentColor" strokeWidth={2} />
            <span>Collections</span>
            <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-brand px-1.5 text-[10px] tabular-nums text-white">{collectionCount}</span>
          </button>
          <button type="button" onClick={() => router.push("/liked")} className="flex h-10 w-32 items-center justify-start gap-1.5 border-b-2 border-transparent px-1 text-left text-sm font-medium text-black/40 transition active:text-black">
            <Heart className="h-4 w-4" strokeWidth={2} />
            <span>Liked</span>
            <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-black/[0.06] px-1.5 text-[10px] tabular-nums text-black/40">{likedTemplates.length}</span>
          </button>
        </div>

        {savedTemplates.length ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {interactions.collections.filter((collection) => collection.templateIds.length > 0).map((collection) => {
              const previews = collection.templateIds.flatMap((id) => {
                const template = templates.find((item) => item.id === id);
                return template ? [template] : [];
              }).slice(0, 3);
              return (
                <button key={collection.id} type="button" onClick={() => router.push(`/collections/${collection.id}`)} className="block min-w-0 rounded-2xl bg-[#f2f2f2] px-3 pb-3 pt-2 text-left transition active:scale-[0.98]">
                  <span className="relative block h-28 w-full" aria-hidden="true">
                    {previews.map((template, index) => (
                      <span
                        key={template.id}
                        className="absolute top-1 aspect-[9/16] w-14 overflow-hidden rounded-lg border-2 border-[#f2f2f2] bg-white"
                        style={{ left: (previews.length - 1 - index) * 16, zIndex: index + 1, transform: `rotate(${(index - (previews.length - 1) / 2) * 5}deg)` }}
                      >
                        {template.thumbnailUrl ?? template.galleryImages[0] ? <Image src={(template.thumbnailUrl ?? template.galleryImages[0])!} alt="" fill sizes="56px" className="object-cover" /> : template.videoSrc ? <video src={template.videoSrc} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-[#e8e6e1]" />}
                      </span>
                    ))}
                  </span>
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{collection.name}</span>
                      <span className="mt-0.5 block text-[11px] text-black/40">{collection.templateIds.length} {collection.templateIds.length === 1 ? "template" : "templates"}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-black/30" strokeWidth={2} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {savedTemplates.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl bg-[#f2f2f2] px-5 py-9 text-center">
            <Bookmark className="h-6 w-6 text-black/30" />
            <p className="mt-3 text-sm font-medium text-black/55">No saved templates yet</p>
            <p className="mt-1 text-xs text-black/35">They’ll appear here when you save one.</p>
          </div>
        ) : null}
      </div>

      <div className="mt-10">
        <button type="button" onClick={signOut} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] text-sm font-semibold text-red-600 transition active:scale-[0.98]"><LogOut className="h-4 w-4" /> Sign out</button>
      </div>
      </div>
      </div>
    </section>
  );
}

function TemplateGallery({ template, onClose }: { template: Template; onClose: () => void }) {
  const galleryImages = template.galleryImages;
  const [activeImage, setActiveImage] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const multiple = galleryImages.length > 1;

  useEffect(() => {
    if (!carouselApi) return;
    const updateActiveImage = () => setActiveImage(carouselApi.selectedScrollSnap());
    carouselApi.on("select", updateActiveImage);
    carouselApi.on("reInit", updateActiveImage);
    return () => {
      carouselApi.off("select", updateActiveImage);
      carouselApi.off("reInit", updateActiveImage);
    };
  }, [carouselApi]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBackground = html.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.backgroundColor = "#000000";
    body.style.backgroundColor = "#000000";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.backgroundColor = previousHtmlBackground;
      body.style.backgroundColor = previousBodyBackground;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") carouselApi?.scrollPrev();
      else if (event.key === "ArrowRight") carouselApi?.scrollNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [carouselApi, onClose]);

  const closeOnBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`${template.name} gallery`} className="fixed inset-0 z-[2000] flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <span aria-live="polite" className="flex h-9 min-w-12 items-center justify-center rounded-full bg-white/10 px-3 text-center text-xs font-semibold tabular-nums text-white backdrop-blur-md">
          {activeImage + 1}/{galleryImages.length}
        </span>
        <button type="button" aria-label="Close gallery" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition active:scale-90"><X className="h-5 w-5" /></button>
      </div>

      <div onClick={closeOnBackdrop} className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center px-3 py-2">
        <Carousel opts={{ align: "start", loop: multiple }} setApi={setCarouselApi} className="w-full">
          <CarouselContent>
            {galleryImages.map((imageSrc, index) => (
              <CarouselItem key={`${imageSrc}-${index}`}>
                <div className="relative h-[58dvh] w-full sm:h-[68dvh]">
                  <Image src={imageSrc} alt={template.galleryAltText[index] || `${template.name} image ${index + 1}`} fill sizes="(min-width: 640px) 768px, 100vw" className="object-contain" priority={index === 0} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {multiple ? (
            <>
              <CarouselPrevious className="absolute left-1 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition active:scale-90 disabled:opacity-30 sm:flex" />
              <CarouselNext className="absolute right-1 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition active:scale-90 disabled:opacity-30 sm:flex" />
            </>
          ) : null}
        </Carousel>
      </div>

      {multiple ? (
        <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {galleryImages.map((imageSrc, index) => (
            <button
              key={`${imageSrc}-thumb-${index}`}
              type="button"
              aria-label={`Go to image ${index + 1}`}
              aria-current={index === activeImage}
              onClick={() => carouselApi?.scrollTo(index)}
              className={`relative h-13 w-13 shrink-0 overflow-hidden rounded-lg transition ${index === activeImage ? "opacity-100 ring-2 ring-white" : "opacity-45 active:opacity-75"}`}
            >
              <Image src={imageSrc} alt="" fill sizes="52px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailVideoPlayer({ template, active, mobileOverlay }: { template: Template; active: boolean; mobileOverlay?: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const speedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureStartRef = useRef({ x: 0, y: 0 });
  const suppressTapRef = useRef(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(active);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speeding, setSpeeding] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const videoSrc = template.videoSrc;
  const videoEmbedUrl = template.videoEmbedUrl;
  const embed = useMemo(() => (videoEmbedUrl ? parseVideoEmbedUrl(videoEmbedUrl) : null), [videoEmbedUrl]);
  const hasMedia = Boolean(embed) || Boolean(videoSrc);
  const previewImage = template.thumbnailUrl ?? template.galleryImages[0];
  const showsVisual = hasMedia || Boolean(previewImage);

  const youtube = useEmbedPlayer(youtubeContainerRef, embed, muted);
  const playing = embed ? youtube.playing : videoPlaying;
  const duration = embed ? youtube.duration : videoDuration;
  // Embeds report their real ratio once loaded; until then guess from the link type.
  const frameRatio = aspectRatio ?? (embed ? youtube.aspectRatio ?? embedFallbackRatio(embed) : null);
  const currentTime = embed ? youtubeCurrentTime : videoCurrentTime;

  useEffect(() => {
    if (embed) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!active) {
      video.pause();
      return;
    }

    video.play().catch(() => undefined);
  }, [active, muted, embed]);

  const { ready: youtubeReady, play: youtubePlay, pause: youtubePause, getCurrentTime: youtubeGetCurrentTime } = youtube;

  // Deliberately depends only on the stable play/pause functions, not the
  // whole `youtube` object: that object's identity also changes whenever
  // `playing` changes, which would re-run this on every manual pause/play
  // and immediately re-force playback to match `active` (still true).
  useEffect(() => {
    if (!embed || !youtubeReady) return;
    if (!active) {
      youtubePause();
      return;
    }
    youtubePlay();
  }, [active, embed, youtubeReady, youtubePlay, youtubePause]);

  useEffect(() => {
    if (!active) return;
    const resumePlayback = () => {
      if (document.visibilityState !== "visible") return;
      if (embed) youtubePlay();
      else videoRef.current?.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", resumePlayback);
    return () => document.removeEventListener("visibilitychange", resumePlayback);
  }, [active, embed, youtubePlay]);

  useEffect(() => {
    if (!embed || !playing) return;
    const interval = setInterval(() => setYoutubeCurrentTime(youtubeGetCurrentTime()), 250);
    return () => clearInterval(interval);
  }, [embed, playing, youtubeGetCurrentTime]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  };

  const clearSpeedTimer = () => {
    if (speedTimerRef.current) clearTimeout(speedTimerRef.current);
    speedTimerRef.current = null;
  };

  const stopSpeeding = () => {
    clearSpeedTimer();
    if (embed) youtube.setPlaybackRate(1);
    else if (videoRef.current) videoRef.current.playbackRate = 1;
    setSpeeding(false);
  };

  const togglePlayback = () => {
    if (!hasMedia) return;
    if (embed) {
      if (playing) youtube.pause();
      else youtube.play();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  return (
    <div
      className={`relative w-full bg-[#f2f2f2] ${showsVisual && !frameRatio ? "aspect-[9/16]" : ""}`}
      style={frameRatio ? { aspectRatio: String(frameRatio) } : undefined}
    >
      {embed ? (
        <div ref={youtubeContainerRef} className="absolute inset-0 h-full w-full overflow-hidden" />
      ) : videoSrc ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          src={videoSrc}
          autoPlay={active}
          muted={muted}
          loop
          playsInline
          preload={active ? "auto" : "metadata"}
          disablePictureInPicture
          onPlay={() => setVideoPlaying(true)}
          onPause={() => setVideoPlaying(false)}
          onCanPlay={(event) => { if (active) event.currentTarget.play().catch(() => undefined); }}
          onLoadedData={(event) => { if (active) event.currentTarget.play().catch(() => undefined); }}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setVideoDuration(video.duration || 0);
            if (video.videoWidth && video.videoHeight) setAspectRatio(video.videoWidth / video.videoHeight);
          }}
          onDurationChange={(event) => setVideoDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setVideoCurrentTime(event.currentTarget.currentTime)}
        />
      ) : previewImage ? (
        <Image
          src={previewImage}
          alt=""
          fill
          sizes="(min-width: 1024px) 600px, 100vw"
          className="object-contain"
          priority
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) setAspectRatio(image.naturalWidth / image.naturalHeight);
          }}
        />
      ) : null}
      <div
        className="absolute inset-0"
        onPointerDown={(event) => {
          gestureStartRef.current = { x: event.clientX, y: event.clientY };
          suppressTapRef.current = false;
          clearSpeedTimer();
          if (!hasMedia) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left + rect.width / 2) return;
          speedTimerRef.current = setTimeout(() => {
            suppressTapRef.current = true;
            if (embed) {
              youtube.setPlaybackRate(2);
            } else if (videoRef.current) {
              videoRef.current.playbackRate = 2;
              videoRef.current.play().catch(() => undefined);
            }
            setSpeeding(true);
            triggerHaptic(12);
          }, 350);
        }}
        onPointerMove={(event) => {
          const distance = Math.hypot(event.clientX - gestureStartRef.current.x, event.clientY - gestureStartRef.current.y);
          if (distance > 12 && !speeding) {
            suppressTapRef.current = true;
            clearSpeedTimer();
          }
        }}
        onPointerUp={() => {
          clearSpeedTimer();
          if (speeding) stopSpeeding();
        }}
        onPointerCancel={stopSpeeding}
        onClick={() => {
          if (suppressTapRef.current) {
            suppressTapRef.current = false;
            return;
          }
          togglePlayback();
        }}
      />
      {speeding ? (
        <div className="pointer-events-none absolute right-5 top-5 z-20 flex items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
          <FastForward className="h-5 w-5" fill="currentColor" /> 2×
        </div>
      ) : null}
      {!playing && active && hasMedia ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/55 text-white backdrop-blur"><Play className="ml-1 h-7 w-7" fill="currentColor" /></span>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent px-4 pb-4 pt-16">
        {mobileOverlay ? <div className={`pointer-events-auto min-[900px]:hidden ${hasMedia ? "mb-2" : ""}`}>{mobileOverlay}</div> : null}
        {hasMedia ? <div className="pointer-events-auto flex items-center gap-2 text-[10px] text-white/70">
          <span className="shrink-0 tabular-nums">{formatTime(currentTime)}</span>
          <input
            type="range"
            aria-label={`Seek ${template.name}`}
            min={0}
            max={duration || 0}
            step="0.01"
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => {
              const nextTime = Number(event.target.value);
              if (embed) {
                youtube.seekTo(nextTime);
                setYoutubeCurrentTime(nextTime);
              } else if (videoRef.current) {
                videoRef.current.currentTime = nextTime;
                setVideoCurrentTime(nextTime);
              }
            }}
            className="detail-video-seek min-w-0 flex-1"
            style={{ backgroundImage: `linear-gradient(to right, white ${duration > 0 ? Math.min(100, Math.max(0, currentTime / duration * 100)) : 0}%, rgb(255 255 255 / 25%) 0)` }}
          />
          <span className="shrink-0 text-right tabular-nums">{formatTime(duration)}</span>
          <button
            type="button"
            aria-label={muted ? "Unmute video" : "Mute video"}
            onClick={() => setMuted((current) => !current)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center ${muted ? "text-white/50" : "text-white"}`}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div> : null}
      </div>
    </div>
  );
}

function formatVideoDuration(totalSeconds: number) {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

function subscribeToHoverCapability(onChange: () => void) {
  const query = window.matchMedia("(hover: hover)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function ReelMedia({ template, eager = false, hovered = false }: { template: Template; eager?: boolean; hovered?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const videoSrc = template.videoSrc;
  const videoEmbedUrl = template.videoEmbedUrl;
  const embed = useMemo(() => (videoEmbedUrl ? parseVideoEmbedUrl(videoEmbedUrl) : null), [videoEmbedUrl]);
  const hasVideo = Boolean(embed) || Boolean(videoSrc);
  const { play: youtubePlay, pause: youtubePause, ready: youtubeReady, playing: youtubeStarted, duration: youtubeDuration } = useEmbedPlayer(youtubeContainerRef, shouldLoad ? embed : null, true, true);
  const intersectingRef = useRef(false);
  const embedThumbnail = useEmbedThumbnail(embed, shouldLoad && !(template.thumbnailUrl ?? template.galleryImages[0]));
  const [inView, setInView] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playingVideoSrc, setPlayingVideoSrc] = useState<string | null>(null);
  const durationSeconds = embed ? youtubeDuration : videoDuration;
  const canHover = useSyncExternalStore(subscribeToHoverCapability, () => window.matchMedia("(hover: hover)").matches, () => true);

  useEffect(() => {
    const target = containerRef.current;
    if (!target || !hasVideo) return;

    const observer = new IntersectionObserver(([entry]) => {
      intersectingRef.current = entry.isIntersecting;
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setShouldLoad(true);
      if (embed) return;
      if (entry.isIntersecting) videoRef.current?.play().catch(() => undefined);
      else videoRef.current?.pause();
    }, { rootMargin: "240px 0px", threshold: 0.01 });

    observer.observe(target);
    return () => observer.disconnect();
  }, [embed, hasVideo]);

  // YouTube previews play only while hovered on devices that can hover; touch
  // devices have no hover, so they keep playing while the card is in view.
  const youtubeShouldPlay = canHover ? hovered && inView : inView;
  useEffect(() => {
    if (!embed || !youtubeReady) return;
    if (youtubeShouldPlay) youtubePlay();
    else youtubePause();
  }, [embed, youtubeReady, youtubeShouldPlay, youtubePlay, youtubePause]);

  const previewImage = template.thumbnailUrl ?? template.galleryImages[0];

  if (!hasVideo) {
    return (
      <div ref={containerRef} className="relative w-full bg-black">
        {previewImage
          ? <Image
              src={previewImage}
              alt=""
              width={900}
              height={1200}
              sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, (max-width: 1279px) 17vw, 12vw"
              loading={eager ? "eager" : "lazy"}
              className="block h-auto w-full"
            />
          : <div className="aspect-[9/16] w-full bg-[#f2eee8]" />}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-[#f2eee8]">
      {previewImage ? <Image src={previewImage} alt="" fill sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, (max-width: 1279px) 17vw, 12vw" loading={eager ? "eager" : "lazy"} className="object-cover" /> : null}
      {embed ? (
        <>
          {embedThumbnail && !previewImage ? <img
            src={embedThumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          /> : null}
          <div
            ref={youtubeContainerRef}
            className="absolute left-1/2 top-0 h-full -translate-x-1/2 overflow-hidden"
            style={{
              // YouTube fits inside its iframe; widen landscape embeds to crop them to the portrait card.
              width: embed.provider === "youtube" ? `${Math.max(1, embedFallbackRatio(embed) / (9 / 16)) * 100}%` : "100%",
              opacity: youtubeStarted && youtubeShouldPlay ? 1 : 0,
            }}
          />
        </>
      ) : videoSrc ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: playingVideoSrc === videoSrc ? 1 : 0 }}
          src={shouldLoad ? videoSrc : undefined}
          muted
          loop
          playsInline
          preload={eager ? "auto" : "metadata"}
          disablePictureInPicture
          onPlaying={() => setPlayingVideoSrc(videoSrc ?? null)}
          onError={() => setPlayingVideoSrc(null)}
          onCanPlay={(event) => { if (intersectingRef.current) event.currentTarget.play().catch(() => undefined); }}
          onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration || 0)}
        />
      ) : null}
      {!hovered && Number.isFinite(durationSeconds) && durationSeconds > 0 ? (
        <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white shadow-sm backdrop-blur-2xl"><Play aria-hidden="true" className="h-3 w-3 shrink-0" fill="currentColor" />{formatVideoDuration(durationSeconds)}</span>
      ) : null}
    </div>
  );
}

// Retained so the artwork fallback can be restored after video-only testing.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Motif({ template }: { template: Template }) {
  const common = "absolute rounded-full";
  if (template.motif === "flowers") {
    return (
      <>
        <div className={`${common} left-[18%] top-[18%] h-24 w-24 bg-white/72`} />
        <div className={`${common} left-[24%] top-[24%] h-16 w-16 bg-[rgba(186,120,104,0.32)]`} />
        <div className={`${common} left-[57%] top-[28%] h-32 w-32 bg-white/60`} />
        <div className={`${common} left-[62%] top-[34%] h-20 w-20 bg-[rgba(124,93,80,0.24)]`} />
        <div className="absolute bottom-[12%] left-[20%] h-44 w-44 rounded-[48px] bg-white/38 rotate-[-14deg]" />
      </>
    );
  }
  if (template.motif === "lantern") {
    return (
      <>
        <div className="absolute left-[50%] top-[16%] h-[62%] w-[26%] -translate-x-1/2 rounded-[44px] bg-white/62" />
        <div className="absolute left-[50%] top-[24%] h-[44%] w-[14%] -translate-x-1/2 rounded-full bg-[rgba(122,95,73,0.18)]" />
        <div className="absolute bottom-[16%] left-[50%] h-20 w-20 -translate-x-1/2 rounded-full border border-white/50" />
      </>
    );
  }
  if (template.motif === "origami") {
    return (
      <>
        <div className="absolute left-[25%] top-[26%] h-36 w-36 rotate-45 rounded-[30px] bg-white/64" />
        <div className="absolute left-[45%] top-[40%] h-28 w-28 rotate-12 rounded-[24px] bg-[rgba(122,141,159,0.24)]" />
        <div className="absolute right-[20%] top-[22%] h-32 w-32 -rotate-12 rounded-[34px] bg-white/45" />
      </>
    );
  }
  if (template.motif === "card") {
    return (
      <>
        <div className="absolute left-[18%] top-[18%] h-[60%] w-[64%] rounded-[32px] bg-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.06)]" />
        <div className="absolute left-[24%] top-[28%] h-24 w-24 rounded-[28px] bg-[rgba(201,162,157,0.25)]" />
        <div className="absolute right-[24%] top-[38%] h-24 w-24 rounded-full bg-[rgba(117,104,101,0.16)]" />
      </>
    );
  }
  if (template.motif === "wreath") {
    return (
      <>
        <div className="absolute left-1/2 top-[18%] h-[58%] w-[58%] -translate-x-1/2 rounded-full border-[28px] border-white/62" />
        <div className="absolute left-1/2 top-[28%] h-[38%] w-[38%] -translate-x-1/2 rounded-full bg-[rgba(169,188,147,0.2)]" />
      </>
    );
  }
  if (template.motif === "clay") {
    return (
      <>
        <div className="absolute left-[23%] top-[26%] h-[42%] w-[54%] rounded-[44px] bg-white/56 shadow-[0_22px_50px_rgba(0,0,0,0.06)]" />
        <div className="absolute left-[32%] top-[38%] h-[18%] w-[36%] rounded-[28px] bg-[rgba(132,110,96,0.16)]" />
      </>
    );
  }
  if (template.motif === "vase") {
    return (
      <>
        <div className="absolute left-1/2 top-[16%] h-[60%] w-[26%] -translate-x-1/2 rounded-[40px] bg-white/64" />
        <div className="absolute left-1/2 top-[34%] h-[18%] w-[18%] -translate-x-1/2 rounded-[24px] bg-[rgba(165,129,103,0.2)]" />
      </>
    );
  }
  return (
    <>
      <div className="absolute left-[18%] top-[32%] h-40 w-40 rounded-[34px] bg-white/62" />
      <div className="absolute right-[18%] top-[24%] h-48 w-24 rounded-[28px] bg-[rgba(127,139,119,0.2)]" />
      <div className="absolute bottom-[16%] left-[46%] h-28 w-28 -translate-x-1/2 rounded-full bg-white/44" />
    </>
  );
}

function CategoryIcon({ icon, className = "h-5 w-5 shrink-0" }: { icon?: string; className?: string }) {
  const Icon = {
    hammer: Hammer,
    palette: Palette,
    puzzle: Puzzle,
    pencil: Pencil,
    "clipboard-list": ClipboardList,
    "graduation-cap": GraduationCap,
    "book-open": BookOpen,
  }[icon ?? ""] ?? Shapes;

  return <Icon aria-hidden="true" className={className} strokeWidth={1.7} />;
}

function SubscribeIcon() {
  return <Gem aria-hidden="true" className="h-5 w-5" strokeWidth={1.7} />;
}

export default AppShell;
