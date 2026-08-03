"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getXyzrankBoard } from "@/src/data/catalog/client";
import type { SimilarShow, XyzrankEpisodeItem, XyzrankTab } from "@/src/data/catalog/types";
import { isEpisodeSaved, removeEpisode, saveEpisode } from "@/src/data/repos/savedEpisodesRepo";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewEpisode } from "@/src/features/player/preview";
import { DegradedHint, MachineLabel, NothingToggle, SettleIn } from "@/src/ui";
import { ShowMoreButton } from "./Charts";
import { ShowRowCompact } from "./ShowRowCompact";

/**
 * 中文播客榜 (xyzrank.com) — that site's own four boards, verbatim, at the
 * bottom of Discover: 热门播客/新晋播客 (popular/emerging podcasts) and
 * 热门单集/新晋单集 (hot/rising episodes). Unlike Charts above, this keeps
 * xyzrank's own rank order rather than re-scoring it — the point is showing
 * their rankings specifically. Every row is saveable, and episode rows carry
 * the same OpenInLinks "listen anywhere" row as the Library, since xyzrank
 * itself only links back to 小宇宙.
 */
const TABS: { id: XyzrankTab; label: string; kind: "shows" | "episodes" }[] = [
  { id: "podcasts", label: "热门播客", kind: "shows" },
  { id: "new-podcasts", label: "新晋播客", kind: "shows" },
  { id: "episodes", label: "热门单集", kind: "episodes" },
  { id: "new-episodes", label: "新晋单集", kind: "episodes" },
];
const DEFAULT_VISIBLE = 10;

export function XyzrankBoard() {
  const [tab, setTab] = useState<XyzrankTab>("podcasts");
  const [showAll, setShowAll] = useState(false);
  const active = TABS.find((t) => t.id === tab)!;

  const q = useQuery({
    queryKey: ["catalog", "charts", "xyzrank", tab],
    queryFn: () => getXyzrankBoard(tab, 20),
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
        {"The community's own 小宇宙 leaderboard — same four boards as "}
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
          <ChartTab
            key={t.id}
            label={t.label}
            active={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setShowAll(false);
            }}
          />
        ))}
      </div>

      {q.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-surface-border bg-surface px-4 py-6 text-center text-sm text-zinc-500">
          {
            "This board didn't load — xyzrank sits behind a bot filter; try another tab or check back later."
          }
        </p>
      ) : (
        <>
          {q.data?.degraded && <DegradedHint className="mb-2" />}
          <ol className="flex flex-col gap-2.5">
            {(showAll ? rows : rows.slice(0, DEFAULT_VISIBLE)).map((row, i) =>
              active.kind === "shows" ? (
                <SettleIn key={row.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                  <ShowRowCompact show={row as SimilarShow} />
                </SettleIn>
              ) : (
                <SettleIn key={row.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                  <XyzrankEpisodeRow ep={row as XyzrankEpisodeItem} />
                </SettleIn>
              ),
            )}
          </ol>
          {rows.length > DEFAULT_VISIBLE && (
            <ShowMoreButton
              expanded={showAll}
              hiddenCount={rows.length - DEFAULT_VISIBLE}
              onClick={() => setShowAll((v) => !v)}
            />
          )}
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
    <li className="flex items-start gap-2.5 rounded-card border border-surface-border bg-background p-2.5 shadow-sm">
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
        <p className="line-clamp-3 text-sm font-semibold leading-snug">{ep.title}</p>
        {ep.showTitle &&
          (ep.showId ? (
            <Link
              href={`/show/${ep.showId}`}
              className="line-clamp-1 text-xs text-zinc-500 hover:text-accent hover:underline dark:text-zinc-400"
            >
              {ep.showTitle} →
            </Link>
          ) : (
            <Link
              href={`/search?q=${encodeURIComponent(ep.showTitle)}`}
              className="line-clamp-1 text-xs text-zinc-500 hover:text-accent dark:text-zinc-400"
            >
              {ep.showTitle} →
            </Link>
          ))}
        <p className="mb-1.5 line-clamp-1 text-[11px] text-zinc-400">{ep.why}</p>
        <OpenInLinks
          title={ep.showTitle ? `${ep.showTitle} ${ep.title}` : ep.title}
          showTitle={ep.showTitle}
          appleUrl={ep.appleUrl}
          feedUrl={ep.feedUrl}
          stored={ep.platformLinks}
          showId={ep.showId}
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
