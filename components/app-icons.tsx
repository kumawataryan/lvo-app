// Icons for the navbar, filters and categories: minimal rounded outline icons (Lucide), drawn in the
// current text colour so they turn white on selected (brand) buttons.

import type React from "react";
import {
  Amphora, BookA, BookOpen, Box, Cake, Calculator, ClipboardList, Flame, FlaskConical, Flower, Flower2, Gem, Gift,
  GraduationCap, Hammer, Hand, House, LayoutGrid, Mars, MessageCircle, MoonStar, Palette, PartyPopper, PawPrint, PenLine,
  Pencil, Plus, Puzzle, Recycle, Rocket, Scissors, Search, Shapes, Snowflake, Sofa,
  Sparkles, Sun, UserRound, Users, Venus, WandSparkles, type LucideIcon,
} from "lucide-react";

type IconProps = { className?: string };

const STROKE = 1.8;

function outline(Icon: LucideIcon, defaultClassName = "h-5 w-5 shrink-0") {
  function OutlineIcon({ className = defaultClassName }: IconProps) {
    return <Icon aria-hidden="true" className={className} strokeWidth={STROKE} />;
  }
  return OutlineIcon;
}

/* Navigation */
export const HomeIcon = outline(House, "h-5 w-5 shrink-0");
export const CategoriesIcon = outline(LayoutGrid, "h-5 w-5 shrink-0");
export const SearchIcon = outline(Search, "h-5 w-5 shrink-0");
export const ProfileIcon = outline(UserRound, "h-5 w-5 shrink-0");
export const AddIcon = outline(Plus, "h-5 w-5 shrink-0");
export const CrownIcon = outline(Gem, "h-5 w-5 shrink-0");
export const MoonIcon = outline(MoonStar, "h-5 w-5 shrink-0");

/* Filters and sorting */
export const CakeIcon = outline(Cake);
export const CraftShapesIcon = outline(Shapes);
export const GiftIcon = outline(Gift);
export const BoyIcon = outline(Mars);
export const GirlIcon = outline(Venus);
export const FlameIcon = outline(Flame);
export const SparkleIcon = outline(Sparkles);

/* Difficulty: custom toy-block icons in the same rounded outline style, so the level reads at a glance:
   one block (Easy), two blocks (Medium), a three-block pyramid (Advanced), all standing on the ground. */
export type DifficultyLevel = "Easy" | "Medium" | "Advanced";

function OutlineSvg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

// A rounded toy block with a dot on its face; (x, y) is the top-left corner.
function Block({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width={7} height={7} rx={1.6} />
      <circle cx={x + 3.5} cy={y + 3.5} r={0.6} fill="currentColor" stroke="none" />
    </>
  );
}

const DIFFICULTY_BLOCKS: Record<DifficultyLevel, Array<[number, number]>> = {
  Easy: [[8.5, 12.5]],
  Medium: [[3.5, 12.5], [13.5, 12.5]],
  Advanced: [[3.5, 12.5], [13.5, 12.5], [8.5, 3.5]],
};

export function DifficultyIcon({ level, className = "h-5 w-5 shrink-0" }: IconProps & { level: DifficultyLevel }) {
  return (
    <OutlineSvg className={className}>
      {DIFFICULTY_BLOCKS[level].map(([x, y]) => <Block key={`${x}-${y}`} x={x} y={y} />)}
      <path d="M2.5 21.5h19" />
    </OutlineSvg>
  );
}

/** The Difficulty filter before a level is chosen: a little staircase going up. */
export function DifficultyStepsIcon({ className = "h-5 w-5 shrink-0" }: IconProps) {
  return (
    <OutlineSvg className={className}>
      <path d="M3.5 20h5v-5h5v-5h5V5h2" />
      <path d="M3.5 20h17" />
    </OutlineSvg>
  );
}

/* Categories: matched by name first (so each subcategory gets its own), then the stored icon key. */
const CATEGORY_ICONS_BY_NAME: Record<string, LucideIcon> = {
  diy: Hammer,
  coloring: Palette,
  activities: Puzzle,
  drawing: Pencil,
  worksheets: ClipboardList,
  "craft classes": GraduationCap,
  stories: BookOpen,
  paper: Scissors,
  "paper crafts": Scissors,
  origami: Scissors,
  clay: Amphora,
  recycled: Recycle,
  decor: PartyPopper,
  "diy decor": PartyPopper,
  gifts: Gift,
  animals: PawPrint,
  nature: Flower2,
  mandalas: Flower,
  fantasy: WandSparkles,
  seasonal: Snowflake,
  tracing: PenLine,
  indoor: Sofa,
  outdoor: Sun,
  stem: Rocket,
  sensory: Hand,
  group: Users,
  people: UserRound,
  cartoons: MessageCircle,
  objects: Box,
  math: Calculator,
  literacy: BookA,
  science: FlaskConical,
  puzzles: Puzzle,
  painting: Palette,
};

const CATEGORY_ICONS_BY_KEY: Record<string, LucideIcon> = {
  hammer: Hammer,
  palette: Palette,
  puzzle: Puzzle,
  pencil: Pencil,
  "clipboard-list": ClipboardList,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
};

export function CategoryOutlineIcon({ name, icon, className = "h-5 w-5 shrink-0" }: IconProps & { name?: string | null; icon?: string | null }) {
  const Icon = CATEGORY_ICONS_BY_NAME[(name ?? "").trim().toLowerCase()] ?? CATEGORY_ICONS_BY_KEY[icon ?? ""] ?? Shapes;
  return <Icon aria-hidden="true" className={className} strokeWidth={STROKE} />;
}
