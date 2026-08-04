"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { getPrefs, setInterests } from "@/src/data/repos/prefsRepo";
import { listSaved } from "@/src/data/repos/savedShowsRepo";
import { getSupabase } from "@/src/data/supabase/client";
import { FloatingSearch } from "@/src/features/search/FloatingSearch";
import { useSession } from "@/src/state/useSession";
import { LiquidBackdrop } from "@/src/ui";
import { Charts } from "./Charts";
import { EpisodeCharts } from "./EpisodeCharts";
import { XyzrankBoard } from "./XyzrankBoard";
import { RankedRecs } from "./RankedRecs";
import { SavedRails } from "./SavedRails";
import { SurpriseDeck } from "./SurpriseDeck";
import { TopicEpisodes } from "./TopicEpisodes";
import { TrendingShelf } from "./TrendingShelf";
import { useDiscoverPicks } from "./useDiscoverPicks";

/** High-contrast section heading (dot-matrix) — readable, not whispery. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-brand text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
      {children}
    </span>
  );
}

/** Quick-start lenses when the user hasn't added interests yet — no API
 *  call, no trending fetch. Unmounted the moment a personal tag is added. */
const FALLBACK_INTERESTS = ["墨尔本", "奥德赛", "claude"];

/**
 * Discover: the ranked, discussion-first exploration surface — and now
 * Settings' whole reason to exist (interests + account sync) lives right
 * here, inline, so there's nowhere else you need to go. Today's Pick is a
 * swipeable card deck; the rest of the ranking follows underneath, Charts
 * bringing up the rear since you've usually already scrolled past them.
 * Nothing-brand identity: monochrome machine type, a single Signal-Red
 * accent, dot-matrix marks.
 */
export function DiscoverPage() {
  const { session, configured } = useSession();
  const scope = session?.user.id ?? "local";
  const queryClient = useQueryClient();
  const savedQ = useQuery({ queryKey: ["saved", scope], queryFn: listSaved });
  const saved = savedQ.data ?? [];
  const seedIds = saved.slice(0, 4).map((s) => s.show.id);

  const [topic, setTopic] = useState<string | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);

  // "For You" — user-authored interests (Settings, merged in). Falls back
  // to three static suggestions when empty; never calls a trending API.
  const prefsQ = useQuery({ queryKey: ["prefs", scope], queryFn: getPrefs });
  const interests = prefsQ.data?.interests ?? [];
  const lenses = interests.length > 0 ? interests : FALLBACK_INTERESTS;

  const picks = useDiscoverPicks({ seedIds, topic, interests, savedReady: savedQ.isSuccess });
  const heroPicks = picks.hero ? [picks.hero, ...picks.rest] : [];

  async function addInterest(raw: string) {
    const t = raw.trim();
    if (!t || interests.includes(t)) return;
    await setInterests([...interests, t]);
    await queryClient.invalidateQueries({ queryKey: ["prefs"] });
  }

  async function removeInterest(t: string) {
    if (topic === t) setTopic(null);
    await setInterests(interests.filter((i) => i !== t));
    await queryClient.invalidateQueries({ queryKey: ["prefs"] });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-6 sm:px-8">
      <LiquidBackdrop />

      {deckOpen && <SurpriseDeck terms={lenses} onClose={() => setDeckOpen(false)} />}

      {/* Masthead — compact so "For You" clears the fold on mobile */}
      <div className="mb-4 border-b border-surface-border pb-3">
        <h1 className="font-brand text-xl font-bold tracking-tight sm:text-2xl">
          Your next favorite show is hiding in here.
        </h1>
        {configured && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <InlineSync />
          </div>
        )}
      </div>

      {/* For You — your own interests drive everything below; Wavr Mini
          (the swipe-through deck) leads the row, add more interests inline.
          Not "Wavr" — that name is reserved for the dedicated /wavr tab. */}
      <section className="mb-2">
        <SectionLabel>For You</SectionLabel>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDeckOpen(true)}
            disabled={lenses.length === 0}
            className="font-brand rounded-pill bg-accent px-4 py-2 text-xs uppercase tracking-wider text-white shadow-sm transition-transform hover:shadow-md active:scale-95 disabled:opacity-40"
          >
            Wavr Mini
          </button>
          {lenses.map((i) => (
            <TopicChip
              key={i}
              label={i}
              active={topic === i}
              onClick={() => setTopic((cur) => (cur === i ? null : i))}
              // Fallback suggestions aren't real saved interests — nothing to delete.
              onDelete={interests.length > 0 ? () => removeInterest(i) : undefined}
            />
          ))}
          <InlineAddChip onAdd={addInterest} />
        </div>
      </section>

      {topic === null ? (
        <>
          {/* Trending — sits right under For You, no repeat heading */}
          <TrendingShelf topic={topic} lenses={lenses} hideTitle />

          {/* More Ranks For You — the full ranked list (#1 included, since
              Today's Pick no longer spotlights it separately), capped. */}
          <RankedRecs
            picks={heroPicks}
            count={picks.count}
            topic={topic}
            topicApplied={picks.topicApplied}
            isLoading={picks.isLoading}
            degraded={picks.degraded}
          />
        </>
      ) : (
        /* A tapped tag surfaces the latest EPISODES for it — not shows. */
        <TopicEpisodes topic={topic} />
      )}

      <SavedRails saved={saved} />

      {/* Charts — the crowd's leaderboards, at the very bottom */}
      <div className="mb-12 grid items-start gap-10 lg:grid-cols-2">
        <Charts />
        <EpisodeCharts />
      </div>

      {/* xyzrank.com's own four boards, verbatim — the very bottom of Discover */}
      <div className="mb-12">
        <XyzrankBoard />
      </div>

      <FloatingSearch />
    </main>
  );
}

/** Inline magic-link sync — Settings' account section, merged into Discover. */
function InlineSync() {
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (session) {
    return (
      <button
        type="button"
        onClick={() => void getSupabase()?.auth.signOut()}
        className="font-brand rounded-pill border border-surface-border px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-500 hover:text-foreground"
      >
        Synced as {session.user.email} · Sign out
      </button>
    );
  }
  if (status === "sent") {
    return (
      <span className="text-xs text-zinc-500">Check {email} for your link ✓</span>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !email.trim()) return;
    setStatus("sending");
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-1.5">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com — sync your picks"
        className="font-brand w-48 rounded-pill border border-surface-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="nothing-toggle px-3 py-1.5 text-[11px]"
      >
        {status === "sending" ? "…" : "Sync"}
      </button>
      {status === "error" && <span className="text-xs text-red-500">Failed</span>}
    </form>
  );
}

/** Low-friction inline add for a new "For You" interest — always one tap
 *  (type + Enter), no extra click to reveal the field. */
function InlineAddChip({ onAdd }: { onAdd: (t: string) => void }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const t = draft.trim();
    setDraft("");
    if (t) onAdd(t);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft("");
        }
      }}
      onBlur={commit}
      placeholder="Add an interest…"
      aria-label="Add an interest"
      className="font-brand w-32 shrink-0 rounded-[2px] border border-dashed border-surface-border bg-transparent px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
    />
  );
}

/**
 * Nothing-brand topic toggle — sharp edges, monochrome, dot-matrix type.
 * A real (non-fallback) interest gets a small × badge on its corner —
 * icon-only, no "remove" text, tap to delete without disturbing the main
 * tap-to-filter action underneath.
 */
function TopicChip({
  label,
  active,
  onClick,
  onDelete,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        data-active={active}
        className="nothing-toggle whitespace-nowrap px-3 py-1.5 text-[11px]"
      >
        {label}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Remove ${label}`}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-surface-border bg-background text-[9px] leading-none text-muted-foreground shadow-sm hover:border-foreground hover:text-foreground"
        >
          ×
        </button>
      )}
    </span>
  );
}
