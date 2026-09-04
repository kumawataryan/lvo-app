export type CraftClassVideo = {
  id: string;
  title: string;
  youtubeUrl: string;
  playlist?: {
    id: string;
    videos: CraftClassVideo[];
  };
};
