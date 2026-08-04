"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * App-style bottom navigation — three places, in funnel order: browse
 * (Discovery), commit (Wavr), own (Library). Search is a floating bar (not a
 * tab); Settings folded into Discovery. Sits under the preview player, above
 * everything else.
 *
 * Wavr — already "the loud tab" (always red, even inactive; §1.2 of
 * docs/wavr-route-design.md) — gets the CYLTabBarController-style
 * treatment: a raised circular button poking above the bar's own top edge,
 * rather than a third flat icon+label tab. Discovery and Library stay flat.
 */
const SIDE_TABS = [
  { href: "/", label: "Discovery", icon: CompassIcon, match: (p: string) => p === "/" },
  { href: "/library", label: "Library", icon: LibraryIcon, match: (p: string) => p.startsWith("/library") },
];

function SideTab({ tab }: { tab: (typeof SIDE_TABS)[number] }) {
  const pathname = usePathname();
  const active = tab.match(pathname);
  const Icon = tab.icon;
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className="group flex flex-col items-center gap-1 py-2.5 font-brand text-[10px] uppercase tracking-[0.14em]"
      >
        <Icon
          className={`h-5 w-5 transition-colors ${
            active ? "text-accent" : "text-muted-foreground group-hover:text-foreground"
          }`}
          active={active}
        />
        <span
          className={`transition-colors ${
            active ? "text-accent" : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {tab.label}
        </span>
      </Link>
    </li>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const wavrActive = pathname.startsWith("/wavr");
  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-background/90 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        <SideTab tab={SIDE_TABS[0]} />

        {/* The middle slot is a plain flex-1 spacer in normal flow (keeps
            Discovery/Library correctly spaced, and Wavr in DOM order
            between them); the actual button breaks out of flow via
            `absolute` so it can rise above the bar's top edge — a clean,
            robust web approximation of CYLTabBarController's convex
            centre button (no literal notch cut into the bar's own shape). */}
        <li className="relative flex-1">
          <Link
            href="/wavr"
            aria-current={wavrActive ? "page" : undefined}
            aria-label="Wavr"
            // -translate-y-[38%] pokes it above the bar without reaching
            // far enough to collide with the Play bar (PreviewPlayer,
            // z-45) that floats just above when one is up.
            className="absolute inset-x-0 top-0 flex -translate-y-[38%] flex-col items-center gap-1"
          >
            <span
              className={`nothing-circle h-14 w-14 border-2 shadow-lg ${wavrActive ? "scale-105" : ""}`}
              style={{ background: "var(--accent)", borderColor: "var(--background)", color: "#fff" }}
            >
              <WavrIcon className="h-6 w-6" active={wavrActive} />
            </span>
            <span
              className={`font-brand text-[10px] uppercase tracking-[0.14em] transition-colors ${
                wavrActive ? "text-accent" : "text-accent/70"
              }`}
            >
              Wavr
            </span>
          </Link>
        </li>

        <SideTab tab={SIDE_TABS[1]} />
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
