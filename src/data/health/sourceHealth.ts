import { doubanRating } from "@/src/data/ratings/douban";
import { xiaoyuzhouRating } from "@/src/data/ratings/xiaoyuzhou";
import { bilibiliBuzz } from "@/src/data/buzz/bilibili";
import { dcardBuzz } from "@/src/data/buzz/dcard";
import { doubanGroupDiscussion, lihkgDiscussion, pttDiscussion } from "@/src/data/buzz/forums";
import { hackerNewsBuzz } from "@/src/data/buzz/hackernews";
import { listenNotesBuzz } from "@/src/data/buzz/listennotes";
import { redditBuzz } from "@/src/data/buzz/reddit";
import { v2exBuzz } from "@/src/data/buzz/v2ex";
import { xiaoyuzhouBuzz } from "@/src/data/buzz/xiaoyuzhou";
import { xyzrankBuzz } from "@/src/data/buzz/xyzrank";
import { youtubeBuzz } from "@/src/data/buzz/youtube";

/**
 * Source health check (REFINEMENTS.md #14): "did every rung return a
 * number this week?" for the fragile scrapers/adapters this app depends
 * on. Every provider here already returns `null` on both "not configured"
 * and "genuinely broken" (by design — NO_HARD_DEPS_ON_EXTERNAL_APIS), so
 * this is the one place those two get told apart, via each provider's own
 * documented env var(s).
 *
 * Honesty limits (surfaced in the UI, not hidden):
 *  - A live probe against ONE fixed test title per language. "not ok" can
 *    mean "genuinely down" OR "this specific title didn't match" — no
 *    single podcast is guaranteed to be indexed by every disparate source.
 *    Treat a `configured=true, ok=false` row as "investigate", not "down for certain".
 *  - Apple's rating ladder needs a real numeric iTunes id, not a title —
 *    not included here; check it directly via /api/ratings on a real show.
 *  - Pocket Casts' trending signal is a list, not a per-title lookup — not
 *    included here either; see buzz/pocketcasts.ts's own tests instead.
 */

const EN_TITLE = "This American Life"; // near-universally indexed English podcast
const CN_TITLE = "故事FM"; // near-universally indexed Chinese podcast

export type SourceHealthResult = {
  id: string;
  label: string;
  lang: "EN" | "CN";
  /** False when a required env var is unset — expected skip, not a failure. */
  configured: boolean;
  /** Only meaningful when `configured` — see the honesty limits above. */
  ok: boolean;
  /** ms the check took — a slow-but-ok source is worth watching too. */
  durationMs: number;
};

type Probe = {
  id: string;
  label: string;
  lang: "EN" | "CN";
  /** Env vars this source needs; empty for a no-key scraper (always "configured"). */
  requires: string[];
  check(title: string): Promise<unknown>;
};

const PROBES: Probe[] = [
  { id: "douban-rating", label: "Douban (ratings)", lang: "CN", requires: [], check: doubanRating },
  {
    id: "xiaoyuzhou-rating",
    label: "Xiaoyuzhou (ratings)",
    lang: "CN",
    requires: [],
    check: xiaoyuzhouRating,
  },
  { id: "reddit", label: "Reddit", lang: "EN", requires: [], check: redditBuzz },
  { id: "hackernews", label: "Hacker News", lang: "EN", requires: [], check: hackerNewsBuzz },
  {
    id: "listennotes",
    label: "Listen Notes",
    lang: "EN",
    requires: ["LISTEN_NOTES_API_KEY"],
    check: listenNotesBuzz,
  },
  {
    id: "youtube",
    label: "YouTube",
    lang: "EN",
    requires: ["YOUTUBE_API_KEY"],
    check: youtubeBuzz,
  },
  { id: "xyzrank", label: "中文播客榜 (xyzrank)", lang: "CN", requires: [], check: xyzrankBuzz },
  {
    id: "xiaoyuzhou-buzz",
    label: "Xiaoyuzhou (buzz)",
    lang: "CN",
    requires: ["XIAOYUZHOU_ACCESS_TOKEN", "XIAOYUZHOU_REFRESH_TOKEN"],
    check: xiaoyuzhouBuzz,
  },
  { id: "dcard", label: "Dcard", lang: "CN", requires: [], check: dcardBuzz },
  { id: "ptt", label: "PTT", lang: "CN", requires: [], check: (t) => pttDiscussion(t) },
  { id: "lihkg", label: "LIHKG", lang: "CN", requires: [], check: (t) => lihkgDiscussion(t) },
  {
    id: "douban-groups",
    label: "豆瓣小组 (search)",
    lang: "CN",
    requires: [],
    check: (t) => doubanGroupDiscussion(t),
  },
  { id: "v2ex", label: "V2EX", lang: "CN", requires: [], check: v2exBuzz },
  { id: "bilibili", label: "Bilibili", lang: "CN", requires: [], check: bilibiliBuzz },
];

function isNullish(v: unknown): boolean {
  if (v == null) return true;
  // several providers return a "found nothing" shape rather than a bare
  // null (e.g. { videos: 0 }, { buzz: {...}, evidence: [] }) — treat an
  // all-zero/empty result the same as null for health purposes.
  if (typeof v === "object") {
    const anyV = v as Record<string, unknown>;
    if ("evidence" in anyV && "buzz" in anyV) {
      return Array.isArray(anyV.evidence) && anyV.evidence.length === 0;
    }
  }
  return false;
}

export async function checkSourceHealth(): Promise<SourceHealthResult[]> {
  return Promise.all(
    PROBES.map(async (p) => {
      const configured = p.requires.every((v) => Boolean(process.env[v]));
      const title = p.lang === "CN" ? CN_TITLE : EN_TITLE;
      const start = Date.now();
      if (!configured) {
        return { id: p.id, label: p.label, lang: p.lang, configured: false, ok: false, durationMs: 0 };
      }
      try {
        const result = await p.check(title);
        return {
          id: p.id,
          label: p.label,
          lang: p.lang,
          configured: true,
          ok: !isNullish(result),
          durationMs: Date.now() - start,
        };
      } catch {
        return {
          id: p.id,
          label: p.label,
          lang: p.lang,
          configured: true,
          ok: false,
          durationMs: Date.now() - start,
        };
      }
    }),
  );
}
