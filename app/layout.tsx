import type { Metadata } from "next";
import "./globals.css";
import { StoryPlayerProvider } from "@/components/story-player";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toast";
import { RouteProgress } from "@/components/route-progress";
import { Suspense } from "react";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Lovely Vibes Only Craft Library",
  description: "Premium art and craft templates for calm, easy making.",
  robots: { index: false, follow: false },
  other: {
    "google-adsense-account": "ca-pub-6918828347390330",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body suppressHydrationWarning className="h-full overflow-hidden">
        <Suspense fallback={null}><RouteProgress /></Suspense>
        <Toaster timeout={2500}><StoryPlayerProvider>{children}</StoryPlayerProvider></Toaster>
      </body>
    </html>
  );
}
