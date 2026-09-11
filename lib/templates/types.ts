export type TemplateDifficulty = "easy" | "medium" | "advanced";

export type TemplateCategory = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parentId?: string | null;
};

export const ALL_TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: "diy", name: "DIY", slug: "diy", icon: "hammer", parentId: null },
  { id: "coloring", name: "Coloring", slug: "coloring", icon: "palette", parentId: null },
  { id: "activities", name: "Activities", slug: "activities", icon: "puzzle", parentId: null },
  { id: "drawing", name: "Drawing", slug: "drawing", icon: "pencil", parentId: null },
  { id: "worksheets", name: "Worksheets", slug: "worksheets", icon: "clipboard-list", parentId: null },
  { id: "craft-classes", name: "Craft Classes", slug: "craft-classes", icon: "graduation-cap", parentId: null },
  { id: "stories", name: "Stories", slug: "stories", icon: "book-open", parentId: null },
];

export const DEFAULT_TEMPLATE_CATEGORIES = ALL_TEMPLATE_CATEGORIES.filter(
  (category) => category.slug !== "craft-classes" && category.slug !== "stories",
);

export type TemplateGalleryImage = {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
};

export type TemplateSupply = {
  id: string;
  name: string;
  icon: string | null;
  quantity: string | null;
  notes: string | null;
  sortOrder: number;
};

export type PublishedTemplate = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  durationMinutes: number;
  minimumAge: number | null;
  maximumAge: number | null;
  difficulty: TemplateDifficulty;
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  thumbnailUrl: string | null;
  hasPrintable: boolean;
  isFree: boolean;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string;
  category: TemplateCategory;
  galleryImages: TemplateGalleryImage[];
  supplies: TemplateSupply[];
  tags: string[];
};

export type TemplateListFilters = {
  category?: string;
  search?: string;
  featured?: boolean;
  limit?: number;
};
