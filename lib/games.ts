export type Game = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  minimumAge: number | null;
  maximumAge: number | null;
  htmlUrl: string;
  featuredImageUrl: string | null;
};
