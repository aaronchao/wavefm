"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { SignalsConverge } from "./SignalsConverge";
import { TasteGlasses } from "./TasteGlasses";

/**
 * Wavr's front door for signed-out visitors — one punchy screen that sells
 * the promise (the crowd already did the research; here's what to play) and
 * lets you feel it: signals converge into a pick, and your taste overflows
 * into a feed. Nothing-brand identity, Signal-Red accent, buttery motion
 * that fully stands down under prefers-reduced-motion.
 */
export function Landing() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-10 sm:px-8">
      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <div className="mb-5 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400">
              wavefm · Podcast Discovery
            </span>
          </div>

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            <Reveal delay={0.05}>Stop researching.</Reveal>
            <br />
            <Reveal delay={0.18}>
              Just press{" "}
              <span className="text-accent">play</span>.
            </Reveal>
          </h1>

          <motion.p
            className="mt-5 max-w-md text-lg text-zinc-500"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            wavefm ranks podcasts by the <span className="text-foreground">real human
            discussion</span> behind them — Reddit, 豆瓣, 小宇宙, the charts — so you
            get what to listen to next, and why. One tap plays the bit people
            actually talk about.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
          >
            <Link
              href="/"
              className="rounded-pill bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:shadow-md active:scale-95"
            >
              Explore discovery →
            </Link>
            <Link
              href="/settings"
              className="rounded-pill border border-surface-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:text-foreground"
            >
              Sign in to sync
            </Link>
          </motion.div>

          <motion.p
            className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.6 }}
          >
            Free · no app store · syncs across devices
          </motion.p>
        </div>

        <SignalsConverge />
      </section>

      {/* Interactive metaphor */}
      <section className="mt-24">
        <TasteGlasses />
      </section>

      {/* Features */}
      <section className="mt-24">
        <h2 className="mb-8 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400">
          Built to end the endless research
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Feature key={f.title} {...f} index={i} />
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mt-24 rounded-card border border-surface-border bg-gradient-to-br from-accent-soft/50 to-background p-10 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">Your next favourite is one tap away.</h2>
        <p className="mx-auto mt-2 max-w-md text-zinc-500">
          Let the crowd’s judgement do the digging. You just listen.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-pill bg-accent px-7 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:shadow-md active:scale-95"
        >
          Start discovering →
        </Link>
      </section>
    </main>
  );
}

const FEATURES = [
  { tag: "语言", title: "Language-aware", body: "Search 故事FM, get Chinese neighbours — not the English chart." },
  { tag: "榜单", title: "中文播客榜 + Global", body: "Two live leaderboards ranked by discussion, ratings and metrics." },
  { tag: "▶", title: "The talked-about bit", body: "One tap plays the middle of the episode people rally around." },
  { tag: "OPML", title: "Bring your subs", body: "Import from any app; it syncs to every device on its own." },
];

function Feature({
  tag,
  title,
  body,
  index,
}: {
  tag: string;
  title: string;
  body: string;
  index: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="group rounded-card border border-surface-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={reduce ? { duration: 0 } : { delay: index * 0.06, type: "spring", stiffness: 240, damping: 24 }}
    >
      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-tile bg-accent-soft px-2 font-mono text-xs font-semibold text-accent">
        {tag}
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500">{body}</p>
    </motion.div>
  );
}

function Reveal({ children, delay }: { children: React.ReactNode; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="inline-block"
      initial={reduce ? false : { clipPath: "inset(0 100% 0 0)", opacity: 0 }}
      animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  );
}
