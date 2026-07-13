import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: "Wavr",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="flex items-center gap-5 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-8">
            <Link href="/" className="font-bold">
              Wavr
            </Link>
            <nav className="flex gap-4 text-sm text-zinc-500">
              <Link href="/search" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Search
              </Link>
              <Link href="/topics" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Topics
              </Link>
              <Link href="/library" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Library
              </Link>
              <Link href="/settings" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Settings
              </Link>
            </nav>
          </header>
          {children}
          <PreviewPlayer />
        </Providers>
      </body>
    </html>
  );
}
