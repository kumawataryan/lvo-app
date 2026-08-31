export type TemplateDifficulty = "easy" | "medium" | "advanced";

export type TemplateCategory = {
  id: string;
  name: string;
  slug: string;
};

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
  difficulty: TemplateDifficulty;
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  thumbnailUrl: string | null;
  hasPrintable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string;
  category: TemplateCategory;
  galleryImages: TemplateGalleryImage[];
  supplies: TemplateSupply[];
};

export type TemplateListFilters = {
  category?: string;
  search?: string;
  featured?: boolean;
  limit?: number;
};
