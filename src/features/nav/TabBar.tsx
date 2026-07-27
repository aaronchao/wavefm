"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * App-style bottom navigation — three places, in funnel order: browse
 * (Discovery), commit (Wavr), own (Library). Search is a header icon, not a
 * tab, so the bar stays focused on what people actually do. Sits under the
 * preview player, above everything else.
 *
 * Wavr is the one tab that is red even when INACTIVE (§1.2 of
 * docs/wavr-route-design.md): the accent already marks the active tab, so
 * "make Wavr stand out in red" can only mean carrying the accent while the
 * others are zinc. Only the glyph is tinted — #ff3b30 on white is 3.68:1,
 * fine for a graphic but short of AA for a 10px label, so labels stay neutral.
 */
const TABS = [
  { href: "/", label: "Discovery", icon: CompassIcon, match: (p: string) => p === "/" },
  {
    href: "/wavr",
    label: "Wavr",
    icon: WavrIcon,
    match: (p: string) => p.startsWith("/wavr"),
    /** Always-red treatment; see the note above. */
    signal: true,
  },
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
          const signal = "signal" in t && t.signal === true;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className="group flex flex-col items-center gap-1 py-2.5 font-brand text-[10px] uppercase tracking-[0.14em]"
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    signal
                      ? active
                        ? "text-accent"
                        : "text-accent/60 group-hover:text-accent"
                      : active
                        ? "text-accent"
                        : "text-zinc-400 group-hover:text-foreground"
                  }`}
                  active={active}
                />
                <span
                  className={`transition-colors ${
                    active ? "text-accent" : "text-zinc-400 group-hover:text-foreground"
                  }`}
                >
                  {t.label}
                </span>
                {/* rendered on every tab so the bar keeps a single height */}
                <span
                  aria-hidden
                  className={`h-[3px] w-[3px] rounded-full ${
                    active && signal ? "bg-accent" : "bg-transparent"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { className?: string; active?: boolean };

function CompassIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Five-bar waveform, FILLED rather than stroked so it carries more weight
 * than its outline siblings — Wavr is the loud tab. When active the centre
 * bar breathes: a mirrored tween, not a spring, because this is a continuous
 * loop rather than a settle. Silent under prefers-reduced-motion.
 */
function WavrIcon({ className, active = false }: IconProps) {
  const reduce = useReducedMotion();
  const bars = [7, 13, 19, 13, 7];
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {bars.map((h, i) => {
        const breathing = active && i === 2 && !reduce;
        return (
          <motion.rect
            key={i}
            x={2 + i * 4.4}
            y={(24 - h) / 2}
            width={2.4}
            height={h}
            rx={1.2}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            animate={breathing ? { scaleY: [1, 1.18, 1] } : { scaleY: 1 }}
            transition={
              breathing
                ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
            }
          />
        );
      })}
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
