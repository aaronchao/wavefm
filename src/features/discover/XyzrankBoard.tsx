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
 */
const TABS: { id: XyzrankTab; label: string; kind: "shows" | "episodes" }[] = [
  { id: "podcasts", label: "热门播客", kind: "shows" },
  { id: "new-podcasts", label: "新晋播客", kind: "shows" },
  { id: "episodes", label: "热门单集", kind: "episodes" },
  { id: "new-episodes", label: "新晋单集", kind: "episodes" },
];

export function XyzrankBoard() {
  const [tab, setTab] = useState<XyzrankTab>("podcasts");
  const active = TABS.find((t) => t.id === tab)!;

  const q = useQuery({
    queryKey: ["catalog", "charts", "xyzrank", tab],
    queryFn: () => getXyzrankBoard(tab),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const rows = active.kind === "shows" ? q.data?.shows ?? [] : q.data?.episodes ?? [];

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

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <ChartTab key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
        ))}
      </div>

      {q.isLoading ? (
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
          {q.data?.degraded && <DegradedHint className="mb-2" />}
          <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {active.kind === "shows"
              ? (rows as XyzrankShowItem[]).map((show) => <XyzrankShowRow key={show.id} show={show} />)
              : (rows as XyzrankEpisodeItem[]).map((ep) => <XyzrankEpisodeRow key={ep.id} ep={ep} />)}
          </ol>
        </>
      )}
    </section>
  );
}

function ChartTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`font-brand rounded-pill border px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-surface-border bg-surface text-zinc-500 hover:text-foreground"
      }`}
    >
      {label}
    </button>
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
    <li className="flex items-start gap-2.5 rounded-card border border-white/30 bg-white/30 p-2.5 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-black/30">
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
        <div className="mb-1.5 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
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
    <li className="flex items-start gap-2.5 rounded-card border border-white/30 bg-white/30 p-2.5 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-black/30">
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
        <div className="mb-1.5 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
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
