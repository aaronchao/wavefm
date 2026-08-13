"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getXyzrankBoard } from "@/src/data/catalog/client";
import type { XyzrankEpisodeItem, XyzrankShowItem, XyzrankTab } from "@/src/data/catalog/types";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { isEpisodeSaved, removeEpisode, saveEpisode } from "@/src/data/repos/savedEpisodesRepo";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewEpisode, previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { DegradedHint, MachineLabel, NothingToggle } from "@/src/ui";

/**
 * 中文播客榜 (xyzrank.com) — that site's own four boards, verbatim, at the
 * bottom of Discover: 热门播客/新晋播客 (popular/emerging podcasts) and
 * 热门单集/新晋单集 (hot/rising episodes), each its own full top-50 board
 * (xyzrank's own size, not a cap we impose). Metrics render as compact icon
 * chips instead of a sentence — rank/plays/comments/duration/freshness at a
 * glance, so a row reads in one look rather than a paragraph. Links/cover
 * come straight from xyzrank's own data (each show's own creator submitted
 * them), so Save and "listen anywhere" work immediately with no guessing.
 *
 * Presented as four flat-colour cards, each showing its own count as one
 * big number — tap one and it expands to a full-screen list, rather than a
 * pill-tab row swapping one shared list underneath. All four boards' data
 * is fetched up front (6h cache, same as before) so every card's count is
 * real, not a placeholder guessed at before you open it.
 */
const SIX_HOURS = 6 * 60 * 60 * 1000;
const TABS: { id: XyzrankTab; label: string; kind: "shows" | "episodes" }[] = [
  { id: "podcasts", label: "热门播客", kind: "shows" },
  { id: "new-podcasts", label: "新晋播客", kind: "shows" },
  { id: "episodes", label: "热门单集", kind: "episodes" },
  { id: "new-episodes", label: "新晋单集", kind: "episodes" },
];

export function XyzrankBoard() {
  const [openTab, setOpenTab] = useState<XyzrankTab | null>(null);

  // Four explicit calls, not a loop — hooks can't be called a variable
  // number of times, and TABS is a fixed constant anyway.
  const podcastsQ = useQuery({
    queryKey: ["catalog", "charts", "xyzrank", "podcasts"],
    queryFn: () => getXyzrankBoard("podcasts"),
    staleTime: SIX_HOURS,
  });
  const newPodcastsQ = useQuery({
    queryKey: ["catalog", "charts", "xyzrank", "new-podcasts"],
    queryFn: () => getXyzrankBoard("new-podcasts"),
    staleTime: SIX_HOURS,
  });
  const episodesQ = useQuery({
    queryKey: ["catalog", "charts", "xyzrank", "episodes"],
    queryFn: () => getXyzrankBoard("episodes"),
    staleTime: SIX_HOURS,
  });
  const newEpisodesQ = useQuery({
    queryKey: ["catalog", "charts", "xyzrank", "new-episodes"],
    queryFn: () => getXyzrankBoard("new-episodes"),
    staleTime: SIX_HOURS,
  });

  const queryByTab: Record<XyzrankTab, typeof podcastsQ> = {
    podcasts: podcastsQ,
    "new-podcasts": newPodcastsQ,
    episodes: episodesQ,
    "new-episodes": newEpisodesQ,
  };

  const activeTab = openTab ? TABS.find((t) => t.id === openTab)! : null;

  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="font-brand text-lg font-semibold">中文播客榜</h2>
        <MachineLabel>{"xyzrank.com's own rankings"}</MachineLabel>
      </div>
      <p className="mb-3 text-sm text-zinc-500">
        {"Same four boards as "}
        <a
          href="https://xyzrank.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-accent"
        >
          xyzrank.com
        </a>
        {", playable and saveable right here."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {TABS.map((t) => (
          <BoardCard
            key={t.id}
            tab={t}
            query={queryByTab[t.id]}
            onOpen={() => setOpenTab(t.id)}
          />
        ))}
      </div>

      {activeTab && (
        <BoardOverlay tab={activeTab} query={queryByTab[activeTab.id]} onClose={() => setOpenTab(null)} />
      )}
    </section>
  );
}

type BoardQuery = ReturnType<typeof useQuery<Awaited<ReturnType<typeof getXyzrankBoard>>>>;

// One flat, muted colour per board — replaces the cover-art collage per
// Aaron's own reference (a flat-color chart-list app, not photos) and his
// explicit ask to apply it site-wide: less collage, more clean colour +
// bold type. Desaturated rather than the reference's brighter tones, to
// sit inside WaveFM's own dark, single-accent (Signal Red) palette rather
// than fighting it with four new saturated hues.
const BOARD_COLORS: Record<XyzrankTab, string> = {
  podcasts: "#8a7550",
  "new-podcasts": "#5f7a5f",
  episodes: "#8a5a48",
  "new-episodes": "#4f6478",
};

function BoardCard({
  tab,
  query,
  onOpen,
}: {
  tab: { id: XyzrankTab; label: string; kind: "shows" | "episodes" };
  query: BoardQuery;
  onOpen: () => void;
}) {
  const count = tab.kind === "shows" ? query.data?.shows.length : query.data?.episodes.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={query.isLoading}
      style={{ backgroundColor: BOARD_COLORS[tab.id] }}
      className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-card p-3 text-left shadow-md transition-transform active:scale-[0.97] disabled:opacity-60"
    >
      <p className="font-brand text-sm font-bold text-white drop-shadow">{tab.label}</p>
      {/* A big bold number is the content now, not a collage — same
          "one huge stat" read as the reference. */}
      <div>
        {query.isLoading ? (
          <div className="h-9 w-16 animate-pulse rounded bg-white/20" />
        ) : (
          count != null && (
            <p className="font-brand text-4xl font-black leading-none text-white tabular-nums">
              {count}
            </p>
          )
        )}
        <p className="mt-1 text-[11px] uppercase tracking-wider text-white/70">
          {tab.kind === "shows" ? "shows" : "episodes"}
        </p>
      </div>
    </button>
  );
}

/** Full-screen list for one board — same rows as before, same loading/empty/
 *  degraded handling, just reached by opening a card instead of a tab. */
function BoardOverlay({
  tab,
  query,
  onClose,
}: {
  tab: { id: XyzrankTab; label: string; kind: "shows" | "episodes" };
  query: BoardQuery;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const rows = tab.kind === "shows" ? query.data?.shows ?? [] : query.data?.episodes ?? [];

  return (
    // Above the Play bar (z-45) and tab bar (z-40) — same layer as SearchOverlay.
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3 sm:px-8">
        <p className="font-brand min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wider text-foreground">
          {tab.label}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="font-brand shrink-0 pl-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8">
        {query.isLoading ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-card bg-surface" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-card border border-surface-border bg-surface px-4 py-6 text-center text-sm text-zinc-500">
            {"This board didn't load — xyzrank sits behind a bot filter; try another tab or check back later."}
          </p>
        ) : (
          <>
            {query.data?.degraded && <DegradedHint className="mb-2" />}
            <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {tab.kind === "shows"
                ? (rows as XyzrankShowItem[]).map((show) => <XyzrankShowRow key={show.id} show={show} />)
                : (rows as XyzrankEpisodeItem[]).map((ep) => <XyzrankEpisodeRow key={ep.id} ep={ep} />)}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

/** 12345 -> "1.2万"; 1234 -> "1.2k"; small numbers verbatim. */
function compact(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function daysAgoLabel(days: number): string {
  if (days < 1) return "今天";
  if (days < 2) return "昨天";
  if (days < 30) return `${Math.floor(days)}天前`;
  if (days < 365) return `${Math.floor(days / 30)}月前`;
  return `${Math.floor(days / 365)}年前`;
}

function durationLabel(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分钟`;
  return `${Math.floor(min / 60)}h${min % 60}m`;
}

/** A small icon+value chip — the "less text" building block for every metric. */
function Stat({ icon, value, title }: { icon: string; value: string; title: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-0.5">
      <span aria-hidden>{icon}</span>
      {value}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="font-brand shrink-0 rounded-[2px] bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
      #{rank}
    </span>
  );
}

function useShowSavedToggle(show: XyzrankShowItem) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void isSaved(show.id).then((v) => !cancelled && setSaved(v));
    return () => {
      cancelled = true;
    };
  }, [show.id]);
  function toggle() {
    const next = !saved;
    setSaved(next);
    void (next
      ? saveShow({
          id: show.id,
          source: "itunes",
          title: show.title,
          author: show.author ?? "",
          coverUrl: show.coverUrl,
          feedUrl: show.feedUrl,
          appleUrl: show.appleUrl,
          categories: show.category ? [show.category] : [],
          episodeCount: show.episodeCount,
        })
      : unsaveShow(show.id)
    ).then(() => queryClient.invalidateQueries({ queryKey: ["saved"] }));
  }
  return { saved, toggle };
}

function XyzrankShowRow({ show }: { show: XyzrankShowItem }) {
  const { saved, toggle } = useShowSavedToggle(show);
  return (
    <li className="glass-panel flex items-start gap-2.5 rounded-card p-2.5 shadow-md">
      <CoverPlay
        src={show.coverUrl}
        size={48}
        onPlay={() =>
          previewShowTopEpisodeMiddle({
            id: show.id,
            title: show.title,
            coverUrl: show.coverUrl,
            appleUrl: show.appleUrl,
            feedUrl: show.feedUrl,
          })
        }
        label={`Play a snippet of ${show.title}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <RankBadge rank={show.rank} />
          <Link
            href={`/show/${show.id}`}
            className="line-clamp-1 min-w-0 font-semibold leading-snug hover:text-accent hover:underline"
          >
            {show.title}
          </Link>
        </div>
        {(show.author || show.category) && (
          <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
            {[show.author, show.category].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mb-1.5 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {show.avgPlays != null && <Stat icon="▶" value={compact(show.avgPlays)} title="平均播放量" />}
          {show.avgComments != null && (
            <Stat icon="💬" value={compact(show.avgComments)} title="平均评论数" />
          )}
          {show.episodeCount != null && <Stat icon="🎙" value={`${show.episodeCount}期`} title="节目数" />}
          {show.avgDurationSec != null && (
            <Stat icon="⏱" value={durationLabel(show.avgDurationSec)} title="平均时长" />
          )}
          {show.lastReleaseDaysAgo != null && (
            <Stat icon="📅" value={daysAgoLabel(show.lastReleaseDaysAgo)} title="最近更新" />
          )}
        </div>
        <OpenInLinks
          title={show.title}
          appleUrl={show.appleUrl}
          feedUrl={show.feedUrl}
          stored={show.xiaoyuzhouUrl ? { xiaoyuzhou: show.xiaoyuzhouUrl } : undefined}
          showId={show.id}
          label=""
          resolveMissing={false}
        />
      </div>
      <NothingToggle
        active={saved}
        onClick={toggle}
        ariaLabel={saved ? "Saved ✓" : "Save"}
        className="shrink-0 !px-2"
      >
        {saved ? "✓" : "+"}
      </NothingToggle>
    </li>
  );
}

function XyzrankEpisodeRow({ ep }: { ep: XyzrankEpisodeItem }) {
  const queryClient = useQueryClient();
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEpisodeSaved(ep.id).then((v) => !cancelled && setQueued(v));
    return () => {
      cancelled = true;
    };
  }, [ep.id]);

  function toggleLater() {
    const next = !queued;
    setQueued(next);
    void (next
      ? saveEpisode({
          id: ep.id,
          title: ep.title,
          showId: ep.showId,
          showTitle: ep.showTitle,
          coverUrl: ep.coverUrl,
          categories: [],
          appleUrl: ep.appleUrl,
        })
      : removeEpisode(ep.id)
    ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
  }

  return (
    <li className="glass-panel flex items-start gap-2.5 rounded-card p-2.5 shadow-md">
      <CoverPlay
        src={ep.coverUrl}
        size={48}
        onPlay={() =>
          previewEpisode({
            id: ep.id,
            title: ep.title,
            showId: ep.showId,
            showTitle: ep.showTitle,
            coverUrl: ep.coverUrl,
            appleUrl: ep.appleUrl,
            categories: [],
          })
        }
        label={`Play a snippet of ${ep.title}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <RankBadge rank={ep.rank} />
          <p className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug">{ep.title}</p>
        </div>
        {ep.showTitle && (
          <Link
            href={ep.showId ? `/show/${ep.showId}` : `/search?q=${encodeURIComponent(ep.showTitle)}`}
            className="line-clamp-1 text-xs text-zinc-500 hover:text-accent dark:text-zinc-400"
          >
            {ep.showTitle} →
          </Link>
        )}
        <div className="mb-1.5 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {ep.plays != null && <Stat icon="▶" value={compact(ep.plays)} title="播放量" />}
          {ep.comments != null && <Stat icon="💬" value={compact(ep.comments)} title="评论数" />}
          {ep.subscribers != null && (
            <Stat icon="👥" value={compact(ep.subscribers)} title="播客订阅数" />
          )}
          {ep.durationSec != null && <Stat icon="⏱" value={durationLabel(ep.durationSec)} title="时长" />}
        </div>
        <OpenInLinks
          title={ep.showTitle ? `${ep.showTitle} ${ep.title}` : ep.title}
          showTitle={ep.showTitle}
          appleUrl={ep.appleUrl}
          feedUrl={ep.feedUrl}
          showId={ep.showId}
          label=""
          resolveMissing={false}
        />
      </div>
      <NothingToggle
        active={queued}
        onClick={() => toggleLater()}
        ariaLabel={queued ? "Queued" : "Save for later"}
        className="shrink-0 !px-2"
      >
        {queued ? "✓" : "+"}
      </NothingToggle>
    </li>
  );
}
