import { remainingSec, vibeOfEpisode, type NowEpisode, type TimeBucket } from "./rightNow";

/**
 * "Why you'll like this" — the one line under a surfaced episode (PURE).
 *
 * Decision paralysis is the actual failure mode this app hits: a wall of
 * saved episodes, every one equally plausible, so nothing gets played. That
 * lands hardest on someone with ADHD, where the cost of choosing is the
 * thing that stalls the action, not the listening.
 *
 * Two rules follow from that, and they're why this returns a single string
 * rather than a list of tags:
 *
 *   1. ONE reason, not three. Stacking justifications turns a pick back
 *      into a comparison — the user starts weighing reasons instead of
 *      pressing play. The strongest reason alone is more actionable.
 *   2. The reason must be about THEM, not the episode. "Documentary,
 *      45 min" is metadata. "You're 12 minutes in" is a reason to press
 *      play, because it names something they already started.
 *
 * Ordered strongest-first, and the first that applies wins. Resuming beats
 * everything: an episode already started is the clearest evidence of intent
 * this app has, and finishing it also shrinks the pile.
 */

export type WhyContext = {
  bucket: TimeBucket;
  /** Show titles the user has saved — a saved show is a stated preference. */
  savedShowTitles?: Set<string>;
  /** How many other saved episodes share this episode's vibe. */
  vibeCount?: number;
};

function minutes(sec: number): number {
  return Math.max(1, Math.round(sec / 60));
}

export function whyThis(episode: NowEpisode, ctx: WhyContext): string {
  const left = remainingSec(episode);

  // 1. Already started — the strongest signal, and it drains the pile.
  if (episode.status === "in_progress" && left != null && left > 0) {
    return `You're partway in — ${minutes(left)} min left`;
  }

  // 2. It fits the slot they just chose. Only worth saying when the fit is
  //    close; "8 min fits your 1 hour" is technically true and useless.
  if (left != null && ctx.bucket.maxSec != null) {
    const slotMin = minutes(ctx.bucket.maxSec);
    const leftMin = minutes(left);
    if (leftMin >= slotMin * 0.55) {
      return `${leftMin} min — fits the time you've got`;
    }
  }

  // 3. From a show they chose to save.
  if (episode.showTitle && ctx.savedShowTitles?.has(episode.showTitle)) {
    return `From ${episode.showTitle}, one of your saved shows`;
  }

  // 4. Matches a vibe they've been collecting — only once there's a real
  //    pattern, since "1 other episode" isn't evidence of anything.
  if (ctx.vibeCount != null && ctx.vibeCount >= 3) {
    const vibe = vibeOfEpisode(episode);
    return `${vibe.emoji} ${vibe.label} — you've saved ${ctx.vibeCount} like this`;
  }

  // 5. Short enough to not be a commitment. The honest last resort: when
  //    nothing else applies, low cost is itself the reason to just start.
  if (left != null && left <= 20 * 60) {
    return `Only ${minutes(left)} min — easy one to start`;
  }

  return "Saved for later — still waiting on you";
}
