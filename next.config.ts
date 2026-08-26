import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.29.96"],
  images: supabaseUrl ? {
    remotePatterns: [{
      protocol: "https",
      hostname: new URL(supabaseUrl).hostname,
      pathname: "/storage/v1/object/public/template-media/**",
    }],
  } : undefined,
};

export default nextConfig;
