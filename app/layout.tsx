import type { Metadata } from "next";
import { Doto, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TabBar } from "@/src/features/nav/TabBar";
import { ThemeToggle } from "@/src/features/nav/ThemeToggle";
import { PreviewPlayer } from "@/src/features/player/PreviewPlayer";
import { Providers } from "@/src/state/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Nothing-brand dot-matrix display face (free, Google Fonts) — used for the
// logo, headings, machine labels and nav; body copy stays Geist for reading.
const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "WaveFM",
  description: "Free, browser-based podcast discovery — what to listen to next, and why.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${doto.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* apply the stored (or system) theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("wavefm.theme");document.documentElement.dataset.theme=t==="dark"||t==="light"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){document.documentElement.dataset.theme="light"}`,
          }}
        />
        <Providers>
          <header className="flex items-center justify-between border-b border-surface-border px-4 py-3 sm:px-8">
            <Link href="/" className="flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                aria-hidden
              />
              <span className="font-brand text-xl font-bold tracking-wide">WaveFM</span>
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 pb-16">{children}</div>
          <PreviewPlayer />
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
