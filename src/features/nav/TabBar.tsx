"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * App-style bottom navigation — the whole app lives in two places
 * (Discovery, Library) plus quick Search. Settings is a small icon up top,
 * not a tab, so the bar stays focused on what people actually do. Sits
 * under the preview player, above everything else.
 */
const TABS = [
  { href: "/", label: "Discovery", icon: CompassIcon, match: (p: string) => p === "/" },
  { href: "/search", label: "Search", icon: SearchIcon, match: (p: string) => p.startsWith("/search") },
  { href: "/library", label: "Library", icon: LibraryIcon, match: (p: string) => p.startsWith("/library") },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-background/90 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-brand uppercase tracking-[0.14em] transition-colors ${
                  active ? "text-accent" : "text-zinc-400 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { className?: string };

function CompassIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function LibraryIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 4v16l7-3 7 3V4a1 1 0 00-1-1H6a1 1 0 00-1 1z" strokeLinejoin="round" />
    </svg>
  );
}
