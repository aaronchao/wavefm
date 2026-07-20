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
  title: "wavefm",
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
            <Link href="/" className="font-brand text-xl font-bold tracking-wide">
              WAVEFM
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Link
                href="/settings"
                aria-label="Settings"
                className="rounded-full p-2 text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinejoin="round" />
                </svg>
              </Link>
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
