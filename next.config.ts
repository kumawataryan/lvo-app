import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // Lets phones/iPads on the local network load the dev server's JavaScript. Without this the page
  // renders but never starts (blank or frozen screens) whenever the device's local IP changes.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "127.0.0.1", "*.local"],
  // Site is not public yet: ask crawlers not to index or follow anything, including non-HTML assets.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  // Keep visited pages in the client router cache so back/forward and repeat taps are instant.
  experimental: { staleTimes: { dynamic: 30, static: 300 } },
  images: {
    // Vercel's image CDN keeps optimized images for 31 days instead of re-fetching/re-optimizing them.
    minimumCacheTTL: 60 * 60 * 24 * 31,
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
