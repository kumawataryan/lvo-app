"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, ArrowUpRight, Bookmark, ChevronDown, ChevronRight, Clock3, Compass, Download, Droplets, FastForward, FileText, Folder, FolderPlus, Gem, Heart, Image as ImageIcon, Images, LayoutTemplate, LogOut, MoonStar, MoreHorizontal, Package, Pause, Pencil, Play, Plus, Quote, Ruler, Scissors, Search, Share2, Shapes, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { gsap } from "gsap";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { EmailIcon, EmailShareButton, FacebookIcon, FacebookShareButton, LinkedinIcon, LinkedinShareButton, PinterestIcon, PinterestShareButton, ThreadsIcon, ThreadsShareButton, TwitterIcon, TwitterShareButton, WhatsappIcon, WhatsappShareButton } from "react-share";
import { fetchPublishedTemplates } from "@/lib/templates/client";
import type { PublishedTemplate } from "@/lib/templates/types";
import { PLAN_DETAILS } from "@/lib/payments/plans";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useStoryPlayer } from "@/components/story-player";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

export type Tab = "templates" | "browse" | "stories" | "products" | "profile";
type QuickAction = "share" | "like" | "save" | "download" | "open";
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
type CardFeedback = { templateId: string; action: "like" | "save"; active: boolean; nonce: number };

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
type TemplateCollection = { id: string; name: string; templateIds: string[] };
type TemplateCollectionRow = Omit<TemplateCollection, "templateIds"> & { template_collection_items: Array<{ template_id: string }> };
export type TemplateInteractions = {
  liked: Set<string>;
  saved: Set<string>;
  collections: TemplateCollection[];
  toggleLike: (templateId: string) => Promise<void>;
  saveToCollection: (templateId: string, options: { collectionId?: string; newName?: string }) => Promise<boolean>;
  removeSaved: (templateId: string) => Promise<boolean>;
};

function triggerHaptic(pattern: number | number[] = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

async function downloadTemplate(template: Template) {
  if (!template.hasPrintable) {
    window.alert("The printable file for this template is not available yet.");
    return;
  }

  try {
    const linkResponse = await fetch(`/api/templates/${template.slug}/download`);
    const linkData = await linkResponse.json();
    if (!linkResponse.ok || !linkData.url) {
      window.alert(linkData.error || "The printable file could not be downloaded. Please try again.");
      return;
    }

    const response = await fetch(linkData.url);
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

    const file = await response.blob();
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${template.slug}-template.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.alert("The printable file could not be downloaded. Please try again.");
  }
}

export type Template = {
  id: string;
  name: string;
  slug: string;
  category: string;
  time: string;
  difficulty: "Easy" | "Medium" | "Advanced";
  supplies: string;
  description: string;
  videoSrc: string;
  galleryImages: string[];
  galleryAltText: string[];
  supplyItems: Array<{ name: string; icon: string | null }>;
  hasPrintable: boolean;
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
    time: `${template.durationMinutes} min`,
    difficulty,
    supplies: `${template.supplies.length} ${template.supplies.length === 1 ? "supply" : "supplies"}`,
    description: template.shortDescription,
    videoSrc: template.videoUrl,
    galleryImages: template.galleryImages.map((image) => image.url),
    galleryAltText: template.galleryImages.map((image) => image.altText),
    supplyItems: template.supplies.map((supply) => ({ name: supply.name, icon: supply.icon })),
    hasPrintable: template.hasPrintable,
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
    const [likesResult, collectionsResult] = await Promise.all([
      supabase.from("template_likes").select("template_id").eq("user_id", nextUser.id),
      supabase.from("template_collections").select("id, name, template_collection_items(template_id)").eq("user_id", nextUser.id).order("created_at"),
    ]);
    if (!likesResult.error) setLiked(new Set((likesResult.data ?? []).map((item: { template_id: string }) => item.template_id)));
    if (!collectionsResult.error) {
      const rows = (collectionsResult.data ?? []) as TemplateCollectionRow[];
      setCollections(rows.map(({ id, name, template_collection_items }) => ({ id, name, templateIds: template_collection_items.map((item) => item.template_id) })));
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

  return { liked, saved, collections, toggleLike, saveToCollection, removeSaved };
}

const VALID_TABS: Tab[] = ["templates", "browse", "stories", "products", "profile"];

function CraftApp({ initialTemplates = [], canAddTemplates = false, subscribed = false, initialTab }: { initialTemplates?: PublishedTemplate[]; canAddTemplates?: boolean; subscribed?: boolean; initialTab?: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>(() => initialTemplates.map(mapPublishedTemplate));
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "templates");
  const [browseCategory, setBrowseCategory] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState("All");
  const [templateSearch, setTemplateSearch] = useState("");
  const [detailTemplate, setDetailTemplate] = useState<Template | null>(null);
  const player = useStoryPlayer();
  const storyDetailRef = useRef<StoryDetailHandle | null>(null);
  const interactions = useTemplateInteractions();
  const categories = useMemo(() => Array.from(new Set(templates.map((item) => item.category))), [templates]);

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

  const filteredTemplates = useMemo(() => {
    return browseCategory ? templates.filter((template) => template.category === browseCategory) : templates;
  }, [browseCategory, templates]);

  const categoryList = tab === "browse" && browseCategory
    ? filteredTemplates
    : templateCategory === "All"
      ? templates
      : templates.filter((template) => template.category === templateCategory);

  const activeList = categoryList.filter((template) => {
    const query = templateSearch.trim().toLowerCase();
    return !query || `${template.name} ${template.category}`.toLowerCase().includes(query);
  });

  const openTemplate = (template: Template) => {
    setDetailTemplate(template);
    router.push(`/templates/${template.slug}`);
  };

  const openStory = (story: Story) => {
    player.openStory(story);
    router.push(`/stories/${story.id}`);
  };

  return (
    <main className={`h-dvh w-full overflow-hidden ${tab === "stories" ? "bg-black text-white" : "bg-[var(--background)] text-[var(--foreground)]"}`}>
      <div className={`relative isolate mx-auto flex h-[100dvh] w-[100dvw] max-w-[430px] flex-col overflow-hidden ${tab === "stories" ? "bg-black" : "bg-[var(--background)]"}`}>
        {tab === "browse" && browseCategory ? (
          <div className="absolute inset-x-0 top-0 z-20 border-b border-black/5 bg-[color:color-mix(in_srgb,var(--background)_88%,white)]/95 px-5 py-4 backdrop-blur">
            <button
              className="text-sm font-medium text-black/60 transition hover:text-black"
              onClick={() => setBrowseCategory(null)}
            >
              ← Browse
            </button>
          </div>
        ) : null}

        {tab === "browse" && !browseCategory ? (
          <section className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-6">
            <div className="mb-8 max-w-xl">
              <p className="text-xs text-black/40">Browse</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Choose a category</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-black/52">A calm way to move into the same reel, filtered by what you want to make.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {categories.map((category, index) => (
                <button
                  key={category}
                  onClick={() => {
                    setBrowseCategory(category);
                    setTab("browse");
                  }}
                  className="group overflow-hidden rounded-[28px] border border-black/6 bg-white p-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.05)]"
                >
                  <CategoryArt index={index} />
                  <div className="mt-4 flex items-center gap-2.5">
                    <CategoryIcon index={index} />
                    <div>
                      <p className="text-base font-medium">{category}</p>
                      <p className="mt-1 text-sm text-black/45">Explore templates</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : tab === "stories" ? (
          <section className="m-0 flex min-h-0 flex-1 flex-col bg-black p-0">
            <TemplateTopBar dark canAddTemplates={canAddTemplates} subscribed={subscribed} categoriesOverride={["All", "Calm", "Animals", "Adventure", "Sleep"]} activeCategory="All" onCategoryChange={() => undefined} />
            <StoriesScreen onOpenStory={openStory} />
          </section>
        ) : tab === "products" ? (
          <section className="m-0 flex min-h-0 flex-1 flex-col bg-white p-0">
            <TemplateTopBar canAddTemplates={canAddTemplates} subscribed={subscribed} categoriesOverride={["All", "Paper", "Paint", "Clay", "Tools", "Kits"]} activeCategory="All" onCategoryChange={() => undefined} />
            <TemplateFeed templates={templates} onOpenDetail={openTemplate} subscribed={subscribed} interactions={interactions} />
          </section>
        ) : tab === "profile" ? (
          <ProfileScreen templates={templates} interactions={interactions} subscribed={subscribed} />
        ) : (
          <section className="m-0 flex min-h-0 flex-1 flex-col bg-white p-0">
            <TemplateTopBar canAddTemplates={canAddTemplates} subscribed={subscribed} activeCategory={templateCategory} onCategoryChange={setTemplateCategory} categoriesOverride={["All", ...categories]} showSearch searchQuery={templateSearch} onSearchChange={setTemplateSearch} />
            {templatesError ? <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-black/50">{templatesError}</div> : <TemplateFeed templates={activeList} onOpenDetail={openTemplate} subscribed={subscribed} interactions={interactions} />}
          </section>
        )}

      </div>

      {detailTemplate ? (
        <TemplateDetail template={detailTemplate} templates={templates} onBack={() => { setDetailTemplate(null); router.push("/"); }} subscribed={subscribed} interactions={interactions} />
      ) : null}

      {player.story && !player.minimized ? (
        <StoryDetail
          ref={storyDetailRef}
          story={player.story}
          progress={player.progress}
          playing={player.playing}
          onProgressChange={player.setProgress}
          onPlayingChange={player.setPlaying}
          onMinimize={() => { player.minimize(); router.push("/?tab=stories"); }}
        />
      ) : null}

      {!detailTemplate ? <BottomNav active={player.story && !player.minimized ? "stories" : tab} nowPlaying={player.story ? { story: player.story, progress: player.progress, playing: player.playing, onOpen: () => {
        const story = player.story!;
        if (player.minimized) {
          player.restore();
          router.push(`/stories/${story.id}`);
        } else if (storyDetailRef.current) {
          storyDetailRef.current.minimize();
        } else {
          player.minimize();
          router.push("/?tab=stories");
        }
      }, onTogglePlaying: () => player.setPlaying(!player.playing) } : undefined} onChange={(nextTab) => {
        if (player.story) {
          player.setPlaying(false);
          if (!player.minimized) {
            const finish = () => { player.minimize(); router.push("/"); };
            if (storyDetailRef.current) storyDetailRef.current.minimize(finish);
            else finish();
          }
        }
        if (nextTab !== "browse") setBrowseCategory(null);
        setTab(nextTab);
      }} /> : null}

    </main>
  );
}

export function StoriesScreen({ onOpenStory }: { onOpenStory: (story: Story) => void }) {
  const player = useStoryPlayer();

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden bg-black text-white">
      <div className="h-full overflow-y-auto pb-44 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-2 gap-2 p-2">
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
                className="group relative aspect-[3/4] min-w-0 cursor-pointer overflow-hidden rounded-[18px] bg-[#202020] text-left transition active:scale-[0.98]"
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
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    gsap.fromTo(element, { y: "100%" }, { y: "0%", duration: 0.45, ease: "power2.out" });
  }, []);

  const playMinimizeAnimation = (onDone: () => void) => {
    const element = rootRef.current;
    if (!element) {
      onDone();
      return;
    }

    const anchor = document.getElementById("story-nav-anchor");
    const timeline = gsap.timeline({ onComplete: onDone });
    timeline.set(element, { transformOrigin: "center center", pointerEvents: "none" });

    if (anchor) {
      const elementRect = element.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const dx = (anchorRect.left + anchorRect.width / 2) - (elementRect.left + elementRect.width / 2);
      const dy = (anchorRect.top + anchorRect.height / 2) - (elementRect.top + elementRect.height / 2);
      const scale = Math.max(anchorRect.width / elementRect.width, 0.05);

      // A single accelerating fall under "gravity" (quadratic ease-in ~ constant acceleration),
      // shrinking continuously as it approaches and rotating slightly like a dropped object.
      // The nav bar sits at a higher z-index than this screen, so once it reaches the anchor's
      // size and position it's genuinely occluded by (tucked inside) the nav pill above it.
      timeline.to(element, {
        x: dx,
        y: dy,
        scale,
        rotation: 8,
        borderRadius: 20,
        duration: 0.55,
        ease: "power2.in",
      }, 0);

      // Keep shrinking past the anchor's own size while it fades, so it never plateaus and just
      // sits there before vanishing — the scale-down continues all the way through.
      timeline.to(element, { scale: scale * 0.4, opacity: 0, duration: 0.22, ease: "power1.in" }, 0.5);
      return;
    }

    timeline.to(element, { y: "100%", scale: 0.94, opacity: 0.7, duration: 0.45, ease: "power3.inOut" }, 0);
  };

  const handleMinimize = () => playMinimizeAnimation(onMinimize);

  useImperativeHandle(ref, () => ({ minimize: (onDone) => playMinimizeAnimation(onDone ?? onMinimize) }));

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
    <div ref={rootRef} className="fixed inset-0 z-[2000] h-dvh w-full overflow-hidden bg-black text-white">
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

export function TemplateTopBar({ activeCategory, onCategoryChange, dark = false, canAddTemplates = false, subscribed = false, categoriesOverride, showSearch = false, searchQuery = "", onSearchChange }: { activeCategory: string; onCategoryChange: (category: string) => void; dark?: boolean; canAddTemplates?: boolean; subscribed?: boolean; categoriesOverride?: string[]; showSearch?: boolean; searchQuery?: string; onSearchChange?: (query: string) => void }) {
  const router = useRouter();
  const filterCategories = categoriesOverride ?? ["All"];

  return (
    <header className={`shrink-0 px-4 pb-3 pt-5 ${dark ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/lvo.jpg" alt="LVO Crafts logo" width={48} height={48} className={`h-12 w-12 rounded-full border-2 object-cover ${dark ? "border-white" : "border-black"}`} priority />
        </div>
        <div className="flex items-center gap-1">
          {subscribed ? null : (
            <button type="button" aria-label="Subscribe" onClick={() => router.push("/subscription")} className={`flex h-12 items-center gap-1.5 rounded-full px-4 text-xs font-medium shadow-[0_3px_10px_rgba(0,0,0,0.12)] transition active:scale-95 ${dark ? "bg-white text-black" : "bg-black text-white"}`}>
              <SubscribeIcon />
              <span className="flex flex-col items-start leading-tight">
                <span>Subscribe</span>
                <span className={dark ? "text-[11px] text-black/55" : "text-[11px] text-white/65"}>{PLAN_DETAILS.monthly.price}/mo</span>
              </span>
            </button>
          )}
          {canAddTemplates ? (
            <button
              type="button"
              aria-label="Add template"
              onClick={() => router.push("/templates/new")}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white transition active:scale-95"
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
            </button>
          ) : null}
        </div>
      </div>
      {showSearch ? (
        <label className="pointer-events-auto mt-4 flex h-12 touch-manipulation items-center gap-2 rounded-xl bg-black/[0.04] px-4 text-black">
          <Search className="h-4 w-4 text-black/45" />
          <input suppressHydrationWarning value={searchQuery} onChange={(event) => onSearchChange?.(event.target.value)} placeholder="Search templates" aria-label="Search templates" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/40" />
        </label>
      ) : null}
      <div className="mt-5 flex gap-7 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filterCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onCategoryChange(category)}
            className={`shrink-0 whitespace-nowrap pb-1 font-medium transition ${activeCategory === category ? (dark ? "border-b-2 border-white text-white" : "border-b-2 border-black text-black") : (dark ? "text-white/45 hover:text-white/80" : "text-black/45 hover:text-black/80")}`}
          >
            {category}
          </button>
        ))}
      </div>
    </header>
  );
}

function TemplateFeed(props: {
  dark?: boolean;
  templates: Template[];
  onOpenDetail: (template: Template) => void;
  subscribed: boolean;
  interactions: TemplateInteractions;
}) {
  const { templates, dark = false } = props;
  const [quickTemplate, setQuickTemplate] = useState<Template | null>(null);
  const [quickOrigin, setQuickOrigin] = useState({ x: 0, y: 0 });
  const [quickActionTarget, setQuickActionTarget] = useState<QuickAction | null>(null);
  const [quickSheet, setQuickSheet] = useState<"share" | "save" | null>(null);
  const [sheetTemplate, setSheetTemplate] = useState<Template | null>(null);
  const [subscriptionTemplate, setSubscriptionTemplate] = useState<Template | null>(null);
  const [cardFeedback, setCardFeedback] = useState<CardFeedback | null>(null);
  const gesturePointerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actionOffsets: Record<QuickAction, { x: number; y: number }> = {
    like: { x: -50, y: -90 },
    save: { x: -100, y: -45 },
    download: { x: -108, y: 20 },
    share: { x: -78, y: 78 },
    open: { x: -15, y: 105 },
  };

  const openQuickActions = (template: Template, x: number, y: number, pointerId?: number) => {
    triggerHaptic(12);
    setQuickTemplate(template);
    setQuickActionTarget(null);
    gesturePointerRef.current = pointerId ?? null;
    setQuickOrigin({
      x: Math.min(Math.max(x, 122), window.innerWidth - 40),
      y: Math.min(Math.max(y, 120), window.innerHeight - 120),
    });
  };

  const closeQuickActions = () => {
    gesturePointerRef.current = null;
    setQuickActionTarget(null);
    setQuickTemplate(null);
  };

  const showCardFeedback = (templateId: string, action: CardFeedback["action"], active: boolean) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setCardFeedback({ templateId, action, active, nonce: Date.now() });
    feedbackTimerRef.current = setTimeout(() => setCardFeedback(null), 900);
  };

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  useEffect(() => {
    if (!quickTemplate) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [quickTemplate]);

  const actionAtPoint = (x: number, y: number) => {
    const actions = Object.entries(actionOffsets) as Array<[QuickAction, { x: number; y: number }]>;
    const nearest = actions.reduce<{ action: QuickAction | null; distance: number }>((current, [action, offset]) => {
      const distance = Math.hypot(x - (quickOrigin.x + offset.x), y - (quickOrigin.y + offset.y));
      return distance < current.distance ? { action, distance } : current;
    }, { action: null, distance: Number.POSITIVE_INFINITY });
    return nearest.distance < 42 ? nearest.action : null;
  };

  const runQuickAction = (action: QuickAction) => {
    if (!quickTemplate) return;
    triggerHaptic(action === "like" ? 10 : [8, 20, 8]);
    const selectedTemplate = quickTemplate;
    if (action === "like") {
      const willBeLiked = !props.interactions.liked.has(selectedTemplate.id);
      showCardFeedback(selectedTemplate.id, "like", willBeLiked);
      void props.interactions.toggleLike(selectedTemplate.id);
    }
    if (action === "download") {
      if (props.subscribed) void downloadTemplate(selectedTemplate);
      else setSubscriptionTemplate(selectedTemplate);
    }
    if (action === "open") props.onOpenDetail(selectedTemplate);

    closeQuickActions();

    if (action === "share" || action === "save") {
      window.setTimeout(() => {
        setSheetTemplate(selectedTemplate);
        setQuickSheet(action);
      }, 0);
    }
  };

  useEffect(() => {
    if (!quickTemplate || gesturePointerRef.current === null) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId === gesturePointerRef.current) setQuickActionTarget(actionAtPoint(event.clientX, event.clientY));
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== gesturePointerRef.current) return;
      const action = actionAtPoint(event.clientX, event.clientY);
      if (action) runQuickAction(action);
      else closeQuickActions();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, true);
    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId === gesturePointerRef.current) closeQuickActions();
    };

    window.addEventListener("pointercancel", handlePointerCancel, true);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
    };
  });

  return (
    <div className={`relative m-0 h-full overscroll-y-contain p-2 pb-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${quickTemplate ? "overflow-hidden" : "overflow-y-auto"} ${dark ? "bg-black" : "bg-white"}`}>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((template, index) => (
          <TemplateCard
            key={template.id}
            template={template}
            eager={index < 2}
            onOpenDetail={() => props.onOpenDetail(template)}
            onQuickActions={openQuickActions}
            quickActive={quickTemplate?.id === template.id}
            feedback={cardFeedback?.templateId === template.id ? cardFeedback : null}
          />
        ))}
      </div>
      {templates.length === 0 ? <div className="flex min-h-48 items-center justify-center px-8 text-center text-sm text-black/45">No templates match your search.</div> : null}
      {quickTemplate ? (
        <>
          <div className="fixed inset-0 z-[1200] touch-none bg-black/72 backdrop-blur-[5px]" onClick={closeQuickActions} aria-label="Close quick actions" />
          <div
            className="fixed z-[1300] h-0 w-0"
            style={{ left: quickOrigin.x, top: quickOrigin.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-white/[0.06]" />
            <QuickActionButton action="like" target={quickActionTarget} offset={actionOffsets.like} onTarget={setQuickActionTarget} onClick={() => runQuickAction("like")} ariaLabel="Like template" active={props.interactions.liked.has(quickTemplate.id)}><Heart className="h-6 w-6" fill={props.interactions.liked.has(quickTemplate.id) ? "currentColor" : "none"} strokeWidth={1.8} /></QuickActionButton>
            <QuickActionButton action="save" target={quickActionTarget} offset={actionOffsets.save} onTarget={setQuickActionTarget} onClick={() => runQuickAction("save")} ariaLabel="Save template" active={props.interactions.saved.has(quickTemplate.id)}><Bookmark className="h-6 w-6" fill={props.interactions.saved.has(quickTemplate.id) ? "currentColor" : "none"} strokeWidth={1.8} /></QuickActionButton>
            <QuickActionButton action="download" target={quickActionTarget} offset={actionOffsets.download} onTarget={setQuickActionTarget} onClick={() => runQuickAction("download")} ariaLabel="Download printable template"><Download className="h-6 w-6" strokeWidth={1.8} /></QuickActionButton>
            <QuickActionButton action="share" target={quickActionTarget} offset={actionOffsets.share} onTarget={setQuickActionTarget} onClick={() => runQuickAction("share")} ariaLabel="Share template"><Share2 className="h-6 w-6" strokeWidth={1.8} /></QuickActionButton>
            <QuickActionButton action="open" target={quickActionTarget} offset={actionOffsets.open} onTarget={setQuickActionTarget} onClick={() => runQuickAction("open")} ariaLabel="Open template"><ArrowUpRight className="h-6 w-6" strokeWidth={1.8} /></QuickActionButton>
            {quickActionTarget ? <div className="pointer-events-none fixed z-[1301] whitespace-nowrap px-0 py-0 text-2xl font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]" style={{ left: Math.max(quickOrigin.x - 160, 16), top: Math.min(Math.max(quickOrigin.y + 110, 16), window.innerHeight - 52) }}>{quickActionTarget[0].toUpperCase() + quickActionTarget.slice(1)}</div> : null}
          </div>
        </>
      ) : null}
      {quickSheet === "share" && sheetTemplate ? <ShareSheet template={sheetTemplate} onClose={() => { setQuickSheet(null); setSheetTemplate(null); }} /> : null}
      {quickSheet === "save" && sheetTemplate ? <CollectionSheet template={sheetTemplate} interactions={props.interactions} onChange={(active) => showCardFeedback(sheetTemplate.id, "save", active)} onClose={() => { setQuickSheet(null); setSheetTemplate(null); }} /> : null}
      {subscriptionTemplate ? <SubscriptionSheet template={subscriptionTemplate} onClose={() => setSubscriptionTemplate(null)} /> : null}
    </div>
  );
}

function TemplateCard({
  template,
  onOpenDetail,
  onQuickActions,
  quickActive,
  feedback,
  statusIcon,
  eager = false,
}: {
  template: Template;
  onOpenDetail?: () => void;
  onQuickActions?: (template: Template, x: number, y: number, pointerId?: number) => void;
  quickActive?: boolean;
  feedback?: CardFeedback | null;
  statusIcon?: "like" | "save";
  eager?: boolean;
}) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  return (
    <article
      className={`template-card relative m-0 aspect-[9/16] w-full cursor-pointer overflow-hidden rounded-[18px] bg-[#f2eee8] p-0 transition-transform duration-200 ${quickActive ? "z-[1201] touch-none rotate-[-2deg] scale-[1.015]" : "touch-manipulation"}`}
      onContextMenu={(event) => event.preventDefault()}
      onClick={onOpenDetail}
    >
      <ReelMedia template={template} eager={eager} />
      {statusIcon ? (
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md">
          {statusIcon === "like" ? <Heart className="h-4 w-4" fill="currentColor" /> : <Bookmark className="h-4 w-4" fill="currentColor" />}
        </span>
      ) : null}
      {feedback ? (
        <span key={feedback.nonce} aria-live="polite" aria-label={feedback.active ? (feedback.action === "like" ? "Liked" : "Saved") : (feedback.action === "like" ? "Like removed" : "Removed from saved")} className="card-action-feedback pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="flex items-center justify-center text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.7)]">
            {feedback.action === "like" ? <Heart className="h-8 w-8" fill={feedback.active ? "currentColor" : "none"} strokeWidth={2.2} /> : <Bookmark className="h-8 w-8" fill={feedback.active ? "currentColor" : "none"} strokeWidth={2.2} />}
          </span>
        </span>
      ) : null}
      <p className="pointer-events-none absolute bottom-4 left-3 z-10 max-w-[calc(100%-3.5rem)] truncate text-xs font-medium leading-4 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{template.name}</p>
      <button
        type="button"
        aria-label={`Quick actions for ${template.name}`}
        onPointerDown={(event) => {
          event.stopPropagation();
          longPressRef.current = false;
          clearHoldTimer();
          const rect = event.currentTarget.getBoundingClientRect();
          holdTimerRef.current = setTimeout(() => {
            longPressRef.current = true;
            onQuickActions?.(template, rect.left + rect.width / 2, rect.top + rect.height / 2, event.pointerId);
          }, 450);
        }}
        onPointerUp={() => {
          clearHoldTimer();
        }}
        onPointerCancel={clearHoldTimer}
        onClick={(event) => {
          event.stopPropagation();
          if (longPressRef.current) {
            longPressRef.current = false;
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          onQuickActions?.(template, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }}
        className="absolute bottom-2 right-2 z-10 flex h-9 w-9 touch-none items-center justify-center rounded-full bg-white text-black shadow-none transition active:scale-90"
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={2.2} />
      </button>
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

function CollectionSheet({ template, interactions, onClose, onChange }: { template: Template; interactions: TemplateInteractions; onClose: () => void; onChange?: (active: boolean) => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const saveToCollection = async (options: { collectionId?: string; newName?: string }) => {
    setSaving(true);
    const saved = await interactions.saveToCollection(template.id, options);
    setSaving(false);
    if (saved) {
      onChange?.(true);
      onClose();
    }
  };

  const removeSaved = async () => {
    setSaving(true);
    const removed = await interactions.removeSaved(template.id);
    setSaving(false);
    if (removed) {
      onChange?.(false);
      onClose();
    }
  };

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent>
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/15" />
        <div>
          <div className="flex items-center gap-2">
            {creating ? <button type="button" aria-label="Back" onClick={() => setCreating(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05]"><ArrowLeft className="h-4 w-4" /></button> : null}
            <DrawerTitle className="text-lg font-semibold tracking-tight">{creating ? "New collection" : "Save to collection"}</DrawerTitle>
          </div>
        </div>
        <DrawerDescription className="sr-only">Save {template.name} to a collection.</DrawerDescription>
        {creating ? (
          <div className="mt-4 space-y-3">
            <input id="quick-collection-name" aria-label="Collection name" autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) void saveToCollection({ newName: name }); }} placeholder="Collection name" className="h-12 w-full rounded-xl bg-[#f2f2f2] px-4 text-sm outline-none ring-black/10 transition focus:ring-2" />
            <button type="button" disabled={!name.trim() || saving} onClick={() => void saveToCollection({ newName: name })} className="h-12 w-full rounded-xl bg-black text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-black/15">{saving ? "Saving…" : "Create and save"}</button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center gap-3 rounded-xl bg-black px-4 py-3.5 text-left text-sm font-semibold text-white transition active:scale-[0.99]"><FolderPlus className="h-5 w-5" /> New collection</button>
              {interactions.collections.map((collection) => (
                <button key={collection.id} type="button" disabled={saving} onClick={() => void saveToCollection({ collectionId: collection.id })} className="flex w-full items-center gap-3 rounded-xl bg-[#f2f2f2] px-4 py-3.5 text-left text-sm font-medium text-black/75 transition active:scale-[0.99] disabled:opacity-50"><Folder className="h-5 w-5 text-black/40" /><span>{collection.name}</span></button>
              ))}
              {interactions.saved.has(template.id) ? <button type="button" disabled={saving} onClick={() => void removeSaved()} className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium text-black/45 transition active:scale-[0.99] disabled:opacity-50">Remove from saved</button> : null}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function QuickActionButton({ action, target, offset, onTarget, onClick, ariaLabel, active, children }: { action: QuickAction; target: QuickAction | null; offset: { x: number; y: number }; onTarget?: (action: QuickAction) => void; onClick: () => void; ariaLabel: string; active?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} onPointerEnter={() => onTarget?.(action)} onFocus={() => onTarget?.(action)} onClick={onClick} style={{ left: offset.x, top: offset.y }} className={`quick-action-pop absolute flex h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 transform-gpu items-center justify-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-[transform,background-color,color,box-shadow] duration-150 ease-out hover:scale-110 hover:bg-white hover:text-black focus-visible:scale-110 focus-visible:bg-white focus-visible:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95 ${target === action || active ? "scale-110 bg-white !text-black shadow-[0_10px_28px_rgba(0,0,0,0.4)]" : "bg-[#292a27] text-white"}`}>
      {children}
    </button>
  );
}

export function TemplateDetail({ template, templates, onBack, subscribed = false, interactions }: { template: Template; templates: Template[]; onBack: () => void; subscribed?: boolean; interactions: TemplateInteractions }) {
  const reelRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [activeTemplate, setActiveTemplate] = useState(template);
  const [heartBurstTemplate, setHeartBurstTemplate] = useState<string | null>(null);
  const [shareSheet, setShareSheet] = useState(false);
  const [infoPanel, setInfoPanel] = useState<"details" | "supplies" | null>(null);
  const [saveSheet, setSaveSheet] = useState(false);
  const [subscriptionPrompt, setSubscriptionPrompt] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [galleryTemplate, setGalleryTemplate] = useState<Template | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBackground = html.style.backgroundColor;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyBackground = body.style.backgroundColor;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.backgroundColor = "#000000";
    html.style.overflow = "hidden";
    body.style.backgroundColor = "#000000";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.backgroundColor = previousHtmlBackground;
      html.style.overflow = previousHtmlOverflow;
      body.style.backgroundColor = previousBodyBackground;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (window.localStorage.getItem("template-scroll-tutorial-seen") !== "true") setShowScrollHint(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const index = Math.max(templates.findIndex((item) => item.id === template.id), 0);
    const reel = reelRef.current;
    if (!reel) return;
    reel.scrollTo({ top: index * reel.clientHeight, behavior: "instant" });
    setActiveTemplate(template);
  }, [template, templates]);

  const handleReelScroll = () => {
    if (showScrollHint) {
      setShowScrollHint(false);
      window.localStorage.setItem("template-scroll-tutorial-seen", "true");
    }
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const reel = reelRef.current;
      if (!reel || !reel.clientHeight) return;
      const index = Math.min(Math.max(Math.round(reel.scrollTop / reel.clientHeight), 0), templates.length - 1);
      const nextTemplate = templates[index];
      setActiveTemplate((current) => {
        if (current.id === nextTemplate.id) return current;
        window.history.replaceState(window.history.state, "", `/templates/${nextTemplate.slug}`);
        triggerHaptic(7);
        return nextTemplate;
      });
    });
  };

  const liked = interactions.liked.has(activeTemplate.id);
  const saved = interactions.saved.has(activeTemplate.id);
  const canDownload = subscribed;

  const requestDownload = () => {
    if (canDownload) void downloadTemplate(activeTemplate);
    else setSubscriptionPrompt(true);
  };

  const handleDoubleTap = (reelTemplate: Template) => {
    void interactions.toggleLike(reelTemplate.id);
    setHeartBurstTemplate(reelTemplate.id);
    triggerHaptic([10, 25, 14]);
    window.setTimeout(() => {
      setHeartBurstTemplate((current) => current === reelTemplate.id ? null : current);
    }, 850);
  };

  return (
    <div className="fixed inset-0 z-[2000] m-0 h-dvh w-full overflow-hidden border-0 bg-black p-0 text-white">
    <div className="relative m-0 h-dvh w-full overflow-hidden border-0 bg-black p-0">
      <div ref={reelRef} onScroll={handleReelScroll} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {templates.map((reelTemplate) => (
          <section
            key={reelTemplate.id}
            onDoubleClick={(event) => {
              if ((event.target as HTMLElement).closest("button, input")) return;
              handleDoubleTap(reelTemplate);
            }}
            className="relative h-dvh snap-start snap-always touch-manipulation select-none overflow-hidden bg-[#f2eee8]"
          >
            <DetailVideoPlayer template={reelTemplate} active={activeTemplate.id === reelTemplate.id && !galleryTemplate} onDownload={requestDownload} />
            {heartBurstTemplate === reelTemplate.id ? (
              <div className="heart-burst pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                <Heart fill="currentColor" strokeWidth={1.5} />
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <button type="button" aria-label="Back" onClick={onBack} className="absolute left-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/70 backdrop-blur"><ArrowLeft className="h-6 w-6" /></button>
      {showScrollHint ? (
        <button
          type="button"
          onClick={() => {
            setShowScrollHint(false);
            window.localStorage.setItem("template-scroll-tutorial-seen", "true");
          }}
          className="absolute bottom-[42%] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
        >
          <span className="flex h-12 w-12 animate-bounce items-center justify-center rounded-full bg-black/55 backdrop-blur-md"><ArrowUp className="h-6 w-6" /></span>
          <span className="whitespace-nowrap rounded-full bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur-md">Swipe up for next template</span>
        </button>
      ) : null}
        <div className="absolute bottom-24 right-3 z-20 flex flex-col gap-2">
          <button type="button" aria-label="Like" onClick={() => void interactions.toggleLike(activeTemplate.id)} className={`flex h-14 w-14 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)] transition active:scale-90 ${liked ? "scale-105 text-red-400" : "opacity-90 hover:opacity-100"}`}><Heart className="h-7 w-7" fill={liked ? "currentColor" : "none"} /></button>
          <button type="button" aria-label="Save" onClick={() => setSaveSheet(true)} className={`flex h-14 w-14 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)] transition active:scale-90 ${saved ? "scale-105" : "opacity-90 hover:opacity-100"}`}><Bookmark className="h-7 w-7" fill={saved ? "currentColor" : "none"} strokeWidth={1.8} /></button>
          <button type="button" aria-label="Share" onClick={() => setShareSheet(true)} className="flex h-14 w-14 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)] transition active:scale-90 opacity-90 hover:opacity-100"><Share2 className="h-7 w-7" strokeWidth={1.8} /></button>
          <button type="button" aria-label="Supplies" onClick={() => setInfoPanel("supplies")} className="flex h-14 w-14 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)] transition active:scale-90 opacity-90 hover:opacity-100"><Package className="h-7 w-7" /></button>
          {activeTemplate.galleryImages.length ? <button type="button" aria-label="Open image gallery" onClick={() => setGalleryTemplate(activeTemplate)} className="flex h-14 w-14 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)] transition active:scale-90 opacity-90 hover:opacity-100"><Images className="h-7 w-7" strokeWidth={1.8} /></button> : null}
        </div>
      {infoPanel ? (
        <Drawer open onOpenChange={(open) => { if (!open) setInfoPanel(null); }}>
          <DrawerContent>
          <DrawerTitle className="text-lg font-semibold tracking-tight">Supplies</DrawerTitle>
          <DrawerDescription className="sr-only">Template information and materials for {activeTemplate.name}.</DrawerDescription>
          {infoPanel === "supplies" ? (
            <div className="mt-4 flex flex-wrap gap-2">
                {activeTemplate.supplyItems.map((supply) => (
                  <span key={supply.name} className="inline-flex items-center gap-2 rounded-lg bg-[#f2f2f2] px-3 py-2 text-sm font-medium text-black/70">
                    <SupplyItemIcon icon={supply.icon} />{supply.name}
                  </span>
                ))}
            </div>
          ) : null}
          </DrawerContent>
        </Drawer>
      ) : null}
      {saveSheet ? <CollectionSheet template={activeTemplate} interactions={interactions} onClose={() => setSaveSheet(false)} /> : null}
      {shareSheet ? <ShareSheet template={activeTemplate} onClose={() => setShareSheet(false)} /> : null}
      {subscriptionPrompt ? <SubscriptionSheet template={activeTemplate} onClose={() => setSubscriptionPrompt(false)} /> : null}
      {galleryTemplate ? <TemplateGallery template={galleryTemplate} onClose={() => setGalleryTemplate(null)} /> : null}
    </div>
    </div>
  );
}

function SupplyItemIcon({ icon }: { icon: string | null }) {
  const Icon = icon === "scissors" ? Scissors : icon === "droplets" ? Droplets : icon === "pencil" ? Pencil : icon === "ruler" ? Ruler : FileText;
  return <Icon className="h-4 w-4 text-black/45" aria-hidden="true" />;
}

function ShareSheet({ template, onClose }: { template: Template; onClose: () => void }) {
  const url = typeof window === "undefined" ? `/templates/${template.slug}` : window.location.href;
  const title = `Make ${template.name} with LVO Crafts.`;

  const shareToInstagram = async () => {
    if (navigator.share) {
      await navigator.share({ title: template.name, text: `${title} ${url}` }).catch(() => undefined);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => undefined);
    }
    onClose();
  };

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent>
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/15" />
        <DrawerTitle className="text-lg font-semibold tracking-tight">Share template</DrawerTitle>
        <DrawerDescription className="sr-only">Choose where to share {template.name}.</DrawerDescription>

        <div className="mt-5 grid grid-cols-4 gap-x-2 gap-y-4">
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
      </DrawerContent>
    </Drawer>
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
    { tab: "stories", label: "Stories", icon: "stories" },
    // { tab: "products", label: "Products", icon: "products" },
    { tab: "profile", label: "Profile", icon: "profile" },
  ];

  return (
        <nav className="mobile-nav" aria-label="Main navigation">
      <div className="mx-auto flex w-auto items-center justify-center gap-2">
        {items.map((item) => {
          const isNowPlaying = item.tab === "stories" && nowPlaying && active === "stories";
          const itemClassName = `pointer-events-auto flex h-14 flex-none cursor-pointer touch-manipulation select-none items-center justify-center gap-2 overflow-hidden rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.16)] transition-all ${dark ? "bg-white text-black" : "bg-black text-white"} ${active === item.tab ? "w-auto scale-105 px-4" : "w-14 px-0 opacity-90 hover:opacity-100"}`;

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
                {active === item.tab ? <span className="max-w-28 truncate whitespace-nowrap text-sm font-medium">{nowPlaying.story.title}</span> : null}
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
              {active === item.tab ? <span className="whitespace-nowrap text-sm font-medium">{item.label}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

type NavIconName = "templates" | "browse" | "stories" | "products" | "profile";

function NavIcon({ name, active, dark }: { name: NavIconName; active: boolean; dark: boolean }) {
  const Icon = name === "templates"
    ? LayoutTemplate
    : name === "browse"
      ? Compass
      : name === "stories"
        ? MoonStar
      : name === "products"
          ? Shapes
          : UserRound;

  return <Icon aria-hidden="true" className={`h-6 w-6 ${dark ? "text-black" : "text-white"}`} fill={active ? "currentColor" : "none"} strokeWidth={1.8} />;
}

function StoryThumbnailIcon({ story, progress, playing, dark, onTogglePlaying }: { story: Story; progress: number; playing: boolean; dark: boolean; onTogglePlaying: () => void }) {
  const size = 32;
  const strokeWidth = 2;
  const cornerRadius = 9;
  const color = dark ? "#000000" : "#ffffff";
  const track = dark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.3)";
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

function ProfileScreen({ templates, interactions, subscribed = false }: { templates: Template[]; interactions: TemplateInteractions; subscribed?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>();
  const [libraryTab, setLibraryTab] = useState<"saved" | "liked">("saved");
  const [openCollectionId, setOpenCollectionId] = useState<string | null>(null);
  const savedTemplates = templates.filter((template) => interactions.saved.has(template.id));
  const likedTemplates = templates.filter((template) => interactions.liked.has(template.id));
  const collectionCount = interactions.collections.filter((collection) => collection.templateIds.length > 0).length;
  const openCollection = interactions.collections.find((collection) => collection.id === openCollectionId);
  const openCollectionTemplates = openCollection?.templateIds.flatMap((id) => {
    const template = templates.find((item) => item.id === id);
    return template ? [template] : [];
  }) ?? [];

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

  const displayName = typeof user.user_metadata.full_name === "string"
    ? user.user_metadata.full_name
    : typeof user.user_metadata.name === "string"
      ? user.user_metadata.name
      : user.email?.split("@")[0] || "Your account";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <section className="h-full overflow-y-auto bg-white px-4 pb-24 pt-6 text-black">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div aria-hidden="true" className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-black text-xl font-semibold text-white">{initials || "U"}</div>
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

      <div className="mt-8">
        <div className="flex gap-10 border-b border-black/[0.08]">
          <button type="button" aria-pressed={libraryTab === "saved"} onClick={() => setLibraryTab("saved")} className={`flex h-10 w-32 items-center justify-start gap-1.5 border-b-2 px-1 text-left text-sm font-medium transition ${libraryTab === "saved" ? "border-black text-black" : "border-transparent text-black/40"}`}>
            <Bookmark className="h-4 w-4" fill={libraryTab === "saved" ? "currentColor" : "none"} strokeWidth={2} />
            <span>Collections</span>
            <span className={`ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[10px] tabular-nums ${libraryTab === "saved" ? "bg-black text-white" : "bg-black/[0.06] text-black/40"}`}>{collectionCount}</span>
          </button>
          <button type="button" aria-pressed={libraryTab === "liked"} onClick={() => { setLibraryTab("liked"); setOpenCollectionId(null); }} className={`flex h-10 w-32 items-center justify-start gap-1.5 border-b-2 px-1 text-left text-sm font-medium transition ${libraryTab === "liked" ? "border-black text-black" : "border-transparent text-black/40"}`}>
            <Heart className="h-4 w-4" fill={libraryTab === "liked" ? "currentColor" : "none"} strokeWidth={2} />
            <span>Liked</span>
            <span className={`ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[10px] tabular-nums ${libraryTab === "liked" ? "bg-black text-white" : "bg-black/[0.06] text-black/40"}`}>{likedTemplates.length}</span>
          </button>
        </div>

        {libraryTab === "saved" && savedTemplates.length && !openCollection ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {interactions.collections.filter((collection) => collection.templateIds.length > 0).map((collection) => {
              const previews = collection.templateIds.flatMap((id) => {
                const template = templates.find((item) => item.id === id);
                return template ? [template] : [];
              }).slice(0, 3);
              return (
                <button key={collection.id} type="button" onClick={() => setOpenCollectionId(collection.id)} className="block min-w-0 rounded-2xl bg-[#f2f2f2] px-3 pb-3 pt-2 text-left transition active:scale-[0.98]">
                  <span className="relative block h-28 w-full" aria-hidden="true">
                    {previews.map((template, index) => (
                      <span
                        key={template.id}
                        className="absolute top-1 aspect-[9/16] w-14 overflow-hidden rounded-lg border-2 border-[#f2f2f2] bg-white"
                        style={{ left: (previews.length - 1 - index) * 16, zIndex: index + 1, transform: `rotate(${(index - (previews.length - 1) / 2) * 5}deg)` }}
                      >
                        {template.galleryImages[0] ? <Image src={template.galleryImages[0]} alt="" fill sizes="56px" className="object-cover" /> : <video src={template.videoSrc} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
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
        {libraryTab === "saved" && openCollection ? (
          <div className="mt-5">
            <button type="button" onClick={() => setOpenCollectionId(null)} className="flex items-center gap-2 text-left transition active:scale-[0.98]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f2f2f2]"><ArrowLeft className="h-4 w-4" /></span>
              <span>
                <span className="block text-sm font-semibold">{openCollection.name}</span>
                <span className="block text-xs text-black/40">{openCollectionTemplates.length} {openCollectionTemplates.length === 1 ? "template" : "templates"}</span>
              </span>
            </button>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {openCollectionTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} statusIcon="save" onOpenDetail={() => router.push(`/templates/${template.slug}`)} />
              ))}
            </div>
          </div>
        ) : null}
        {libraryTab === "liked" && likedTemplates.length ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {likedTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} statusIcon="like" onOpenDetail={() => router.push(`/templates/${template.slug}`)} />
            ))}
          </div>
        ) : null}
        {(libraryTab === "saved" ? savedTemplates : likedTemplates).length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl bg-[#f2f2f2] px-5 py-9 text-center">
            {libraryTab === "saved" ? <Bookmark className="h-6 w-6 text-black/30" /> : <Heart className="h-6 w-6 text-black/30" />}
            <p className="mt-3 text-sm font-medium text-black/55">No {libraryTab} templates yet</p>
            <p className="mt-1 text-xs text-black/35">They’ll appear here when you {libraryTab === "saved" ? "save" : "like"} one.</p>
          </div>
        ) : null}
      </div>

      {subscribed ? (
        <button type="button" onClick={() => router.push("/subscription/manage")} className="mt-10 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] text-sm font-semibold text-black transition active:scale-[0.98]">
          <Gem className="h-4 w-4" /> Manage subscription
        </button>
      ) : null}

      <button type="button" onClick={signOut} className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] text-sm font-semibold text-red-600 transition active:scale-[0.98] ${subscribed ? "mt-3" : "mt-10"}`}>
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </section>
  );
}

function TemplateGallery({ template, onClose }: { template: Template; onClose: () => void }) {
  const galleryImages = template.galleryImages;
  const [activeImage, setActiveImage] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

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

  return (
    <div className="absolute inset-0 z-50 flex items-center overflow-hidden bg-black">
      <Carousel opts={{ align: "start", loop: galleryImages.length > 1 }} setApi={setCarouselApi} className="w-full">
        <CarouselContent>
          {galleryImages.map((imageSrc, index) => (
            <CarouselItem key={`${imageSrc}-${index}`}>
              <div className="relative aspect-[9/16] w-full overflow-hidden bg-[#f2f2f2]">
                <Image src={imageSrc} alt={template.galleryAltText[index] || `${template.name} image ${index + 1}`} fill sizes="100vw" className="object-cover" priority={index === 0} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {galleryImages.length > 1 ? (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
            <CarouselPrevious className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_18px_rgba(0,0,0,0.22)] transition active:scale-90 disabled:opacity-30" />
            <span aria-label={`Image ${activeImage + 1} of ${galleryImages.length}`} aria-live="polite" className="flex h-10 min-w-14 items-center justify-center rounded-full bg-white px-3 text-center text-[11px] font-semibold tabular-nums text-black shadow-[0_4px_18px_rgba(0,0,0,0.22)]">
              {activeImage + 1}/{galleryImages.length}
            </span>
            <CarouselNext className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_18px_rgba(0,0,0,0.22)] transition active:scale-90 disabled:opacity-30" />
          </div>
        ) : null}
      </Carousel>
      <button type="button" aria-label="Close gallery" onClick={onClose} className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/70 text-white backdrop-blur"><X className="h-6 w-6" /></button>
    </div>
  );
}

function DetailVideoPlayer({ template, active, onDownload }: { template: Template; active: boolean; onDownload: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const speedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureStartRef = useRef({ x: 0, y: 0 });
  const suppressTapRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(active);
  const [speeding, setSpeeding] = useState(false);
  const videoSrc = template.videoSrc;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!active) {
      video.pause();
      return;
    }

    video.play().catch(() => undefined);
  }, [active, muted]);

  useEffect(() => {
    if (!active) return;
    const resumePlayback = () => {
      if (document.visibilityState === "visible") videoRef.current?.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", resumePlayback);
    return () => document.removeEventListener("visibilitychange", resumePlayback);
  }, [active]);

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
    const video = videoRef.current;
    if (video) video.playbackRate = 1;
    setSpeeding(false);
  };

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={videoSrc}
        autoPlay={active}
        muted={muted}
        loop
        playsInline
        preload={active ? "auto" : "metadata"}
        disablePictureInPicture
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onCanPlay={(event) => { if (active) event.currentTarget.play().catch(() => undefined); }}
        onLoadedData={(event) => { if (active) event.currentTarget.play().catch(() => undefined); }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPointerDown={(event) => {
          const video = event.currentTarget;
          gestureStartRef.current = { x: event.clientX, y: event.clientY };
          suppressTapRef.current = false;
          clearSpeedTimer();
          const rect = video.getBoundingClientRect();
          if (event.clientX < rect.left + rect.width / 2) return;
          speedTimerRef.current = setTimeout(() => {
            suppressTapRef.current = true;
            video.playbackRate = 2;
            video.play().catch(() => undefined);
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
        onClick={(event) => {
          if (suppressTapRef.current) {
            suppressTapRef.current = false;
            return;
          }
          if (event.currentTarget.paused) event.currentTarget.play().catch(() => undefined);
          else event.currentTarget.pause();
        }}
      />
      {speeding ? (
        <div className="pointer-events-none absolute right-5 top-5 z-20 flex items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
          <FastForward className="h-5 w-5" fill="currentColor" /> 2×
        </div>
      ) : null}
      {!playing && active ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"><Play className="ml-1 h-7 w-7" fill="currentColor" /></span>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent px-4 pb-4 pt-28">
        <p className="pr-16 text-sm font-semibold text-white">{template.name}</p>
        <p className="mt-1 max-w-[calc(100%-4rem)] text-xs leading-4 text-white/72">{template.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/72">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-white backdrop-blur">{template.category}</span>
          <span>{template.time}</span><span className="h-1 w-1 rounded-full bg-white/45" /><span>{template.difficulty}</span><span className="h-1 w-1 rounded-full bg-white/45" /><span>{template.supplies}</span>
        </div>
        <button type="button" onClick={onDownload} className="pointer-events-auto mb-3 mt-3 flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black shadow-[0_5px_18px_rgba(0,0,0,0.24)] transition active:scale-[0.98]">
          <Download className="h-5 w-5" strokeWidth={2} /> Download template
        </button>
        <div className="pointer-events-auto flex items-center gap-3 text-xs text-white/85">
          <span className="w-8 tabular-nums">{formatTime(currentTime)}</span>
          <input
            type="range"
            aria-label={`Seek ${template.name}`}
            min={0}
            max={duration || 0}
            step="0.01"
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => {
              const nextTime = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = nextTime;
              setCurrentTime(nextTime);
            }}
            className="h-5 min-w-0 flex-1 cursor-pointer accent-white"
          />
          <span className="w-8 text-right tabular-nums">{formatTime(duration)}</span>
          <button
            type="button"
            aria-label={muted ? "Unmute video" : "Mute video"}
            onClick={() => setMuted((current) => !current)}
            className={`flex h-9 w-9 items-center justify-center rounded-full bg-black/45 ${muted ? "text-white/50" : "text-white"}`}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReelMedia({ template, eager = false }: { template: Template; eager?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoSrc = template.videoSrc;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => undefined);
      else video.pause();
    }, { rootMargin: "240px 0px", threshold: 0.01 });

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={videoSrc}
        muted
        loop
        playsInline
        preload={eager ? "auto" : "metadata"}
        disablePictureInPicture
      />
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

function CategoryArt({ index }: { index: number }) {
  const shapes = [
    "from-[#efe8de] via-[#ddd0c2] to-[#c7b39e]",
    "from-[#f2ece6] via-[#d8c4b8] to-[#b8a08c]",
    "from-[#f4f1ea] via-[#d8dedf] to-[#b8c2cc]",
  ];
  return <div className={`h-28 rounded-[24px] bg-gradient-to-br ${shapes[index % shapes.length]} opacity-90`} />;
}

function CategoryIcon({ index }: { index: number }) {
  const paths = [
    "M6 4.5h9l3 3v12H6v-15Zm9 0v3h3M8.5 12h7m-7 3h5",
    "M5 18.5 9 14l3 2 5-7 2 9.5H5Zm11-10.5 1.5-2",
    "m5 9 7-5 7 5m-11 2.5h8v7H8v-7Zm4-2v9",
    "m4 10 8-6 8 6m-14 0v9h12v-9M9 19v-5h6v5",
    "M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15Zm-3 6h.01m5.98 0h.01M9 14c1.7 1.4 4.3 1.4 6 0",
    "m7 8 5-3 5 3v10H7V8Zm-2 3h14m-9 3h4",
    "M12 4.5c4.8 0 8 3.2 8 7.5s-3.2 7.5-8 7.5-8-3.2-8-7.5 3.2-7.5 8-7.5Zm-3 7.5h6",
    "M12 4v3m0 10v3m8-8h-3M7 12H4m13.7-5.7-2.1 2.1M8.4 15.6l-2.1 2.1m0-11.4 2.1 2.1m7.2 7.2 2.1 2.1",
  ];

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center text-black/65">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[index % paths.length]} />
      </svg>
    </span>
  );
}

function SubscribeIcon() {
  return <Gem aria-hidden="true" className="h-5 w-5" strokeWidth={1.7} />;
}

export default CraftApp;
