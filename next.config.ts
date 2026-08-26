import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.29.96"],
  images: {
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
    ],
  },
};

export default nextConfig;
