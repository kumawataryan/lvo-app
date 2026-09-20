import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.29.96", "192.168.29.167", "127.0.0.1"],
  // Site is not public yet: ask crawlers not to index or follow anything, including non-HTML assets.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  images: {
    localPatterns: [
      {
        pathname: "/**",
        search: "",
      },
      {
        pathname: "/api/dropbox/content",
      },
    ],
    remotePatterns: [
      ...(supabaseUrl ? [{
        protocol: "https" as const,
        hostname: new URL(supabaseUrl).hostname,
        pathname: "/storage/v1/object/public/template-media/**",
      }] : []),
      {
        protocol: "https" as const,
        hostname: "www.google.com",
        pathname: "/s2/favicons",
      },
      {
        protocol: "https" as const,
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
};

export default nextConfig;
