"use client";

import { useMemo, useState } from "react";
import {
  rankForNow,
  remainingSec,
  TIME_BUCKETS,
  vibesPresent,
  type NowEpisode,
  type TimeBucket,
} from "@/src/core/library/rightNow";
import { whyThis } from "@/src/core/library/whyThis";
import { previewEpisode } from "@/src/features/player/preview";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import type { SavedEpisode } from "@/src/data/repos/savedEpisodesRepo";
import { haptic, NothingToggle } from "@/src/ui";

/**
 * "Right Now" — the Library's answer to a collection that has outgrown
 * being a list. Replaces Inbox/Queue triage, which was inbox-zero chores
 * on a leisure app: it asked for filing work, so it rotted, and the wall
 * of episodes stayed a wall.
 *
 * Nothing here asks the user to file, rank or tag. Both controls are
 * derived from data already stored — time from `durationSec`/`positionSec`,
 * vibe from `vibeOf()` — so it works on an existing library immediately.
 * See `src/core/library/rightNow.ts` for the (pure, tested) selection rules.
 */
export function RightNow({
  episodes,
  savedShows = [],
}: {
  episodes: SavedEpisode[];
  /** Titles of shows the user saved — a stated preference, so it's one of
   *  the reasons `whyThis` can give for a pick. */
  savedShows?: string[];
}) {
  const [bucket, setBucket] = useState<TimeBucket>(TIME_BUCKETS[1]);
  const [vibeId, setVibeId] = useState<string | null>(null);
  // Walks forward through the ranked candidates for "Something else" —
  // reset whenever the filters change so a new slot starts from its best pick.
  const [skip, setSkip] = useState(0);

  const vibes = useMemo(() => vibesPresent(episodes as NowEpisode[]), [episodes]);
  const candidates = useMemo(
    () => rankForNow(episodes as NowEpisode[], { bucket, vibeId }),
    [episodes, bucket, vibeId],
  );

  function reset(next: () => void) {
    next();
    setSkip(0);
  }

  if (episodes.length === 0) return null;

  const pick = candidates.length ? candidates[skip % candidates.length] : null;
  const saved = pick ? (pick as SavedEpisode) : null;

  // One reason, not a list — see whyThis for why stacking them turns a pick
  // back into a comparison.
  const reason = pick
    ? whyThis(pick, {
        bucket,
        savedShowTitles: new Set(savedShows),
        vibeCount: vibes.find((v) => v.vibe.id === vibeOfPick(pick))?.count,
      })
    : null;

  const play = () => {
    if (!saved) return;
    haptic("commit");
    previewEpisode({
      id: saved.episodeId,
      title: saved.title,
      showId: saved.showId,
      showTitle: saved.showTitle,
      coverUrl: saved.coverUrl,
      appleUrl: saved.appleUrl,
      audioUrl: saved.audioUrl,
      durationSec: saved.durationSec,
      categories: [],
    });
  };

  return (
    <section aria-label="Right now" className="mb-8 rounded-[2px] border border-surface-border p-4">
      <h2 className="font-brand mb-1 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
        Right now
      </h2>
      <p className="mb-3 text-xs text-zinc-500">
        How long have you got? Pick a slot and press play — no sorting required.
      </p>

      <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {TIME_BUCKETS.map((b) => (
          <NothingToggle
            key={b.id}
            active={b.id === bucket.id}
            onClick={() => reset(() => setBucket(b))}
            className="shrink-0 whitespace-nowrap"
          >
            {b.label}
          </NothingToggle>
        ))}
      </div>

      {vibes.length > 1 && (
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <NothingToggle
            active={vibeId === null}
            onClick={() => reset(() => setVibeId(null))}
            className="shrink-0 whitespace-nowrap"
          >
            Anything
          </NothingToggle>
          {vibes.map(({ vibe, count }) => (
            <NothingToggle
              key={vibe.id}
              active={vibeId === vibe.id}
              onClick={() => reset(() => setVibeId(vibeId === vibe.id ? null : vibe.id))}
              className="shrink-0 whitespace-nowrap"
            >
              {vibe.emoji} {vibe.label} {count}
            </NothingToggle>
          ))}
        </div>
      )}

      {saved ? (
        <div className="glass-clear flex items-center gap-3 p-3">
          <CoverPlay
            src={saved.coverUrl}
            size={56}
            onPlay={play}
            label={`Play ${saved.title}`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{saved.title}</p>
            <p className="truncate text-xs text-zinc-500">
              {saved.showTitle ?? "Saved episode"}
              {formatLeft(saved)}
            </p>
            {reason && (
              <p className="mt-0.5 truncate text-xs font-medium text-accent">{reason}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={play}
              className="font-brand rounded-[2px] border border-foreground bg-foreground px-3 py-1.5 text-[11px] uppercase tracking-wider text-background transition-colors hover:bg-background hover:text-foreground"
            >
              Play
            </button>
            {candidates.length > 1 && (
              <button
                type="button"
                onClick={() => setSkip((s) => s + 1)}
                className="font-brand rounded-[2px] border border-surface-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                Another
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-[2px] border border-dashed border-surface-border px-3 py-3 text-xs text-zinc-500">
          Nothing saved fits {bucket.label.toLowerCase()}
          {vibeId ? " in this vibe" : ""} — try a longer slot.
        </p>
      )}
    </section>
  );
}

function vibeOfPick(e: NowEpisode): string {
  return vibesPresent([e])[0]?.vibe.id ?? "";
}

/** " · 24 min left" / " · 24 min" — omitted entirely when unknown. */
function formatLeft(e: SavedEpisode): string {
  const left = remainingSec(e as NowEpisode);
  if (left == null) return "";
  const mins = Math.max(1, Math.round(left / 60));
  return ` · ${mins} min${e.positionSec > 0 ? " left" : ""}`;
}
