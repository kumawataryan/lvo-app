import type { Metadata } from "next";
import "./globals.css";
import { StoryPlayerProvider } from "@/components/story-player";

export const metadata: Metadata = {
  title: "Lovely Vibes Only Craft Library",
  description: "Premium art and craft templates for calm, easy making.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body suppressHydrationWarning className="h-full overflow-hidden">
        <StoryPlayerProvider>{children}</StoryPlayerProvider>
      </body>
    </html>
  );
}
