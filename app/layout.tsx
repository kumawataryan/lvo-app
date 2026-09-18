import type { Metadata } from "next";
import "./globals.css";
import { StoryPlayerProvider } from "@/components/story-player";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Lovely Vibes Only Craft Library",
  description: "Premium art and craft templates for calm, easy making.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body suppressHydrationWarning className="h-full overflow-hidden">
        <StoryPlayerProvider>{children}</StoryPlayerProvider>
      </body>
    </html>
  );
}
