"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getRankedEpisodes, getTopPicks } from "@/src/data/catalog/client";
import type { RankedEpisodeItem, SimilarShow } from "@/src/data/catalog/types";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import {
  previewRankedEpisode,
  previewShowTopEpisodeMiddle,
} from "@/src/features/player/preview";
import { RatingBadges } from "@/src/features/show/RatingBadges";
import { Chip, CoverTile, SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";

/** Match a show to a topic label by any significant shared keyword. */
function matchesTopic(show: SimilarShow, topic: string): boolean {
  const words = topic
    .toLowerCase()
    .split(/[^a-z一-鿿]+/)
    .filter((w) => w.length > 3 || /[一-鿿]/.test(w));
  const hay = `${show.title} ${show.categories.join(" ")}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}

/**
 * The ranked recommendation column: a big For-You hero (#1) followed by an
 * ordered list, each row openable into its episodes. Falls back to trending
 * when the user hasn't saved anything yet (the proxy handles that). A topic
 * chip filters to matching shows, keeping the full list if nothing matches.
 */
export function RankedRecs({
  seedIds,
  topic,
  savedReady,
}: {
  seedIds: string[];
  topic: string | null;
  savedReady: boolean;
}) {
  const picksQ = useQuery({
    queryKey: ["catalog", "top-picks", seedIds.join(",")],
    queryFn: () => getTopPicks(seedIds),
    enabled: savedReady,
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (picksQ.isLoading) {
    return <SkeletonRecs />;
  }

  const all = picksQ.data?.picks ?? [];
  if (all.length === 0) {
    return (
      <p className="rounded-card border border-surface-border bg-surface px-4 py-8 text-center text-sm text-zinc-500">
        Recommendations are quiet right now — save a show or two and they’ll
        wake up.
      </p>
    );
  }

  const filtered = topic ? all.filter((p) => matchesTopic(p, topic)) : all;
  const picks = filtered.length > 0 ? filtered : all;
  const [hero, ...rest] = picks;

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          {topic && filtered.length > 0 ? `Top in ${topic}` : "Ranked for you"}
        </h2>
        <MachineLabel>{picks.length} shows</MachineLabel>
      </div>

      <HeroCard pick={hero} />

      <ol className="mt-4 flex flex-col gap-3">
        {rest.map((pick, i) => (
          <SettleIn key={pick.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
            <RankedRow pick={pick} rank={i + 2} />
          </SettleIn>
        ))}
      </ol>
    </section>
  );
}

/** The #1 recommendation, oversized, with the headline middle-clip play. */
function HeroCard({ pick }: { pick: SimilarShow }) {
  const saved = useSavedToggle(pick);
  return (
    <SettleIn>
      <div className="relative overflow-hidden rounded-card border border-surface-border bg-background p-5 shadow-sm">
        <span className="pointer-events-none absolute right-4 top-4 font-mono text-5xl font-bold leading-none text-surface">
          01
        </span>
        <div className="flex flex-col gap-4 sm:flex-row">
          <CoverTile src={pick.coverUrl} size={120} className="!rounded-card" />
          <div className="min-w-0 flex-1">
            <MachineLabel>Rank 01 · For you</MachineLabel>
            <h3 className="mt-1 truncate text-xl font-bold">{pick.title}</h3>
            <p className="truncate text-sm text-zinc-500">{pick.author}</p>
            <p className="mt-1 text-sm text-accent">▶ {pick.why}</p>
            <div className="mt-2">
              <RatingBadges showId={pick.id} title={pick.title} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => previewShowTopEpisodeMiddle(pick)}
                className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
              >
                ▶ Play the talked-about bit
              </button>
              <Chip active={saved.saved} onClick={saved.toggle}>
                {saved.saved ? "Saved ✓" : "Save"}
              </Chip>
              <Link
                href={`/show/${pick.id}`}
                className="text-sm font-medium text-zinc-500 hover:text-foreground"
              >
                Episodes →
              </Link>
            </div>
          </div>
        </div>
        <EpisodeList show={pick} />
      </div>
    </SettleIn>
  );
}

/** One ranked recommendation, openable into its episodes. */
function RankedRow({ pick, rank }: { pick: SimilarShow; rank: number }) {
  const saved = useSavedToggle(pick);
  return (
    <li className="rounded-card border border-surface-border bg-background p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-center font-mono text-lg font-bold tabular-nums text-zinc-300 dark:text-zinc-600">
          {String(rank).padStart(2, "0")}
        </span>
        <CoverTile src={pick.coverUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{pick.title}</p>
          <p className="truncate text-sm text-zinc-500">{pick.author}</p>
          <p className="truncate text-xs text-accent">▶ {pick.why}</p>
          <div className="mt-1">
            <RatingBadges showId={pick.id} title={pick.title} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => previewShowTopEpisodeMiddle(pick)}
          aria-label={`Play the most-discussed bit of ${pick.title}`}
          className="shrink-0 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
        >
          ▶
        </button>
        <Chip active={saved.saved} onClick={saved.toggle} className="shrink-0">
          {saved.saved ? "✓" : "Save"}
        </Chip>
      </div>
      <EpisodeList show={pick} />
    </li>
  );
}

/** Lazy, collapsible list of a show's episodes ranked by real signal. */
function EpisodeList({ show }: { show: SimilarShow }) {
  const [open, setOpen] = useState(false);
  const epsQ = useQuery({
    queryKey: ["catalog", "episodes-ranked", show.id],
    queryFn: () => getRankedEpisodes(show.id),
    enabled: open,
    staleTime: 6 * 60 * 60 * 1000,
  });

  return (
    <div className="mt-2 border-t border-surface-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-foreground"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        Top episodes
      </button>
      {open && (
        <div className="mt-2">
          {epsQ.isLoading && (
            <p className="py-2 text-xs text-zinc-400">Ranking episodes…</p>
          )}
          {epsQ.isSuccess && epsQ.data.length === 0 && (
            <p className="py-2 text-xs text-zinc-400">
              No episode feed reachable — try the show page.
            </p>
          )}
          <ol className="flex flex-col gap-1.5">
            {(epsQ.data ?? []).map((ep, i) => (
              <EpisodeRow key={ep.id} ep={ep} rank={i + 1} show={show} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const BASIS_LABEL: Record<RankedEpisodeItem["basis"], string> = {
  discussion: "Discussed",
  rating: "Rated",
  recent: "Recent",
};

function EpisodeRow({
  ep,
  rank,
  show,
}: {
  ep: RankedEpisodeItem;
  rank: number;
  show: SimilarShow;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-tile px-2 py-1.5 hover:bg-surface">
      <span className="w-5 shrink-0 text-center font-mono text-xs tabular-nums text-zinc-400">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{ep.title}</p>
        <p className="truncate text-[11px] text-zinc-400">
          <span
            className={`font-mono uppercase tracking-wider ${
              ep.basis === "discussion" ? "text-accent" : ""
            }`}
          >
            {BASIS_LABEL[ep.basis]}
          </span>{" "}
          · {ep.why}
        </p>
      </div>
      <button
        type="button"
        onClick={() => previewRankedEpisode(ep, show)}
        disabled={!ep.audioUrl}
        aria-label={`Play the middle of ${ep.title}`}
        className="shrink-0 rounded-full border border-surface-border px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
      >
        ▶
      </button>
    </li>
  );
}

/** Shared one-click optimistic save toggle. */
function useSavedToggle(pick: SimilarShow) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void isSaved(pick.id).then((v) => !cancelled && setSaved(v));
    return () => {
      cancelled = true;
    };
  }, [pick.id]);
  function toggle() {
    const next = !saved;
    setSaved(next);
    void (next ? saveShow(pick) : unsaveShow(pick.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    );
  }
  return { saved, toggle };
}

function SkeletonRecs() {
  return (
    <section className="mb-12 animate-pulse">
      <div className="mb-4 h-6 w-40 rounded bg-surface" />
      <div className="h-40 rounded-card bg-surface" />
      <div className="mt-4 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-card bg-surface" />
        ))}
      </div>
    </section>
  );
}
