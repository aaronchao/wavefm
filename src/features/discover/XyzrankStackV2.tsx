"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, type PanInfo } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getXyzrankBoard } from "@/src/data/catalog/client";
import type { XyzrankEpisodeItem, XyzrankShowItem } from "@/src/data/catalog/types";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { isEpisodeSaved, removeEpisode, saveEpisode } from "@/src/data/repos/savedEpisodesRepo";
import { DegradedHint, NothingToggle } from "@/src/ui";
import { BOARD_COLORS, TABS } from "./XyzrankBoard";
import { useCoverColor } from "./useCoverColor";

const SIX_HOURS = 6 * 60 * 60 * 1000;
const CARD_HEIGHT = 176; // px — fixed rather than aspect-ratio, so the stack container's own height math (below) stays accurate
const PEEK = 14; // px offset between stacked back cards
type BoardQuery = ReturnType<typeof useQuery<Awaited<ReturnType<typeof getXyzrankBoard>>>>;

/**
 * V2 of the xyzrank four-boards section, built from Aaron's own reference:
 * "make the new 4 cards stacked ... if i swipe up a card, it will expand
 * into full screen with a seamless transition ... in full screen swipe left
 * or right will move to other cards." Lives ABOVE the original grid version
 * (XyzrankBoard) rather than replacing it — his explicit ask was to keep
 * both live for comparison, not to pick one blind.
 *
 * The "seamless" part is one persistent `motion.div` carrying Framer
 * Motion's `layout` prop: the SAME component instance is the small front
 * card and, once expanded, the fullscreen sheet — Framer FLIP-animates the
 * change in size/position/corner-radius instead of a cut between two
 * separate elements.
 *
 * Only the front card (board index 0) is swipe-up-able — the three behind
 * it are decorative peek cards, same as a real card stack (Wallet, Tinder);
 * the other three boards are reached by swiping left/right once expanded.
 */
export function XyzrankStackV2() {
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

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
  const queries: BoardQuery[] = [podcastsQ, newPodcastsQ, episodesQ, newEpisodesQ];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && expanded) close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  function open() {
    setActiveIndex(0);
    setExpanded(true);
  }

  function close() {
    setExpanded(false);
    setActiveIndex(0);
  }

  function handleCardDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -60 || info.velocity.y < -400) open();
  }

  function handlePagerDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60 || info.velocity.x < -400) {
      setActiveIndex((i) => Math.min(i + 1, TABS.length - 1));
    } else if (info.offset.x > 60 || info.velocity.x > 400) {
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  }

  const activeTab = TABS[activeIndex];
  const activeQuery = queries[activeIndex];

  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="font-brand text-lg font-semibold">中文播客榜</h2>
        <span className="font-brand rounded-[2px] bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
          New
        </span>
      </div>
      <p className="mb-3 text-sm text-zinc-500">
        Stacked-card version — swipe the front card up to open, then left/right to move between boards.
      </p>

      <div className="relative" style={{ height: CARD_HEIGHT + (TABS.length - 1) * PEEK }}>
        {TABS.map((tab, i) =>
          i === 0 ? null : (
            <BackCard key={tab.id} tab={tab} query={queries[i]} depth={i} hidden={expanded} />
          ),
        )}

        <motion.div
          layout
          onClick={() => {
            if (!expanded) open();
          }}
          drag={expanded ? "x" : "y"}
          dragConstraints={expanded ? { left: 0, right: 0 } : { top: -140, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={expanded ? handlePagerDragEnd : handleCardDragEnd}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          style={{
            backgroundColor: expanded ? undefined : BOARD_COLORS[TABS[0].id],
            borderRadius: expanded ? 0 : 24,
            height: expanded ? undefined : CARD_HEIGHT,
            // Collapsed, this is just in-page content — z-10 keeps it (and
            // the back cards below) well under the tab bar (z-40) and play
            // bar (z-45) so it can never intercept their clicks. Expanded,
            // z-60 matches BoardOverlay's own fullscreen convention.
            zIndex: expanded ? 60 : 10,
          }}
          className={
            expanded
              ? "fixed inset-0 flex flex-col bg-background"
              : "absolute inset-x-0 top-0 flex cursor-grab flex-col justify-between overflow-hidden p-4 shadow-lg active:cursor-grabbing"
          }
        >
          {expanded ? (
            <>
              <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3 sm:px-8">
                <p className="font-brand min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wider text-foreground">
                  {activeTab.label}
                </p>
                <div className="flex gap-1">
                  {TABS.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={`Go to ${t.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex(i);
                      }}
                      className={`h-1 w-4 rounded-full ${i === activeIndex ? "bg-accent" : "bg-surface-border"}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                  }}
                  className="font-brand shrink-0 pl-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
              {/* Plain key-swap, no exit animation — AnimatePresence's exit
                  transition was getting stuck here (never fully unmounting
                  the old panel, so it sat underneath the new one), likely a
                  clash with the outer hero div's own `layout` animation. A
                  clean cut on left/right is a fine trade against a broken
                  crossfade; the "seamless" ask was about the card→fullscreen
                  expand above, which the `layout` prop still handles. */}
              <motion.div
                key={activeTab.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-1 flex-col overflow-hidden"
              >
                <FullscreenPagerContent tab={activeTab} query={activeQuery} />
              </motion.div>
            </>
          ) : (
            <FrontCardFace tab={TABS[0]} query={queries[0]} />
          )}
        </motion.div>
      </div>
    </section>
  );
}

function BackCard({
  tab,
  query,
  depth,
  hidden,
}: {
  tab: (typeof TABS)[number];
  query: BoardQuery;
  depth: number;
  hidden: boolean;
}) {
  const count = tab.kind === "shows" ? query.data?.shows.length : query.data?.episodes.length;
  return (
    <motion.div
      animate={{ opacity: hidden ? 0 : 1 - depth * 0.16, y: depth * PEEK, scale: 1 - depth * 0.035 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      style={{ backgroundColor: BOARD_COLORS[tab.id], borderRadius: 24, height: CARD_HEIGHT, zIndex: 10 - depth }}
      className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between overflow-hidden p-4 shadow-lg"
    >
      <p className="font-brand text-sm font-bold text-white drop-shadow">{tab.label}</p>
      <div>
        {count != null && (
          <p className="font-brand text-3xl font-black leading-none text-white tabular-nums">{count}</p>
        )}
        <p className="mt-1 text-[11px] uppercase tracking-wider text-white/70">
          {tab.kind === "shows" ? "shows" : "episodes"}
        </p>
      </div>
    </motion.div>
  );
}

function FrontCardFace({ tab, query }: { tab: (typeof TABS)[number]; query: BoardQuery }) {
  const count = tab.kind === "shows" ? query.data?.shows.length : query.data?.episodes.length;
  return (
    <>
      <div className="flex items-start justify-between">
        <p className="font-brand text-sm font-bold text-white drop-shadow">{tab.label}</p>
        <span aria-hidden className="font-brand text-[10px] uppercase tracking-wider text-white/70">
          {"⌃ swipe up"}
        </span>
      </div>
      <div>
        {query.isLoading ? (
          <div className="h-9 w-16 animate-pulse rounded bg-white/20" />
        ) : (
          count != null && (
            <p className="font-brand text-4xl font-black leading-none text-white tabular-nums">{count}</p>
          )
        )}
        <p className="mt-1 text-[11px] uppercase tracking-wider text-white/70">
          {tab.kind === "shows" ? "shows" : "episodes"}
        </p>
      </div>
    </>
  );
}

/** Same loading/empty/degraded handling as the original BoardOverlay, rows
 *  swapped for the decluttered card design. */
function FullscreenPagerContent({ tab, query }: { tab: (typeof TABS)[number]; query: BoardQuery }) {
  const rows = tab.kind === "shows" ? query.data?.shows ?? [] : query.data?.episodes ?? [];
  const fallback = BOARD_COLORS[tab.id];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8">
      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-surface-border bg-surface px-4 py-6 text-center text-sm text-zinc-500">
          {"This board didn't load — xyzrank sits behind a bot filter; try another tab or check back later."}
        </p>
      ) : (
        <>
          {query.data?.degraded && <DegradedHint className="mb-2" />}
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {tab.kind === "shows"
              ? (rows as XyzrankShowItem[]).map((show) => (
                  <DeclutteredShowRow key={show.id} show={show} fallbackColor={fallback} />
                ))
              : (rows as XyzrankEpisodeItem[]).map((ep) => (
                  <DeclutteredEpisodeRow key={ep.id} ep={ep} fallbackColor={fallback} />
                ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Circular b&w cover, a "+" to save, the clickable name, one line of
 *  secondary text below — the exact four elements Aaron asked for, nothing
 *  else. Shows have no separate "episode" line, so author/category fills
 *  that second line instead. */
function DeclutteredShowRow({ show, fallbackColor }: { show: XyzrankShowItem; fallbackColor: string }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const color = useCoverColor(show.coverUrl, fallbackColor);

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

  return (
    <li
      style={{ backgroundColor: color, minHeight: 104 }}
      className="flex flex-col justify-end gap-1 rounded-2xl p-3 shadow-md"
    >
      <div className="mb-auto flex items-start justify-between">
        {show.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={show.coverUrl} alt="" className="h-10 w-10 rounded-full object-cover grayscale" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-white/20" />
        )}
        <NothingToggle
          active={saved}
          onClick={toggle}
          ariaLabel={saved ? "Saved" : "Save"}
          className="!px-2 !py-1 bg-black/25 text-white"
        >
          {saved ? "✓" : "+"}
        </NothingToggle>
      </div>
      <Link href={`/show/${show.id}`} className="font-brand line-clamp-1 text-sm font-bold text-white hover:underline">
        {show.title}
      </Link>
      {(show.author || show.category) && (
        <p className="line-clamp-1 text-xs text-white/70">
          {[show.author, show.category].filter(Boolean).join(" · ")}
        </p>
      )}
    </li>
  );
}

function DeclutteredEpisodeRow({ ep, fallbackColor }: { ep: XyzrankEpisodeItem; fallbackColor: string }) {
  const queryClient = useQueryClient();
  const [queued, setQueued] = useState(false);
  const color = useCoverColor(ep.coverUrl, fallbackColor);

  useEffect(() => {
    let cancelled = false;
    void isEpisodeSaved(ep.id).then((v) => !cancelled && setQueued(v));
    return () => {
      cancelled = true;
    };
  }, [ep.id]);

  function toggle() {
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
    <li
      style={{ backgroundColor: color, minHeight: 104 }}
      className="flex flex-col justify-end gap-1 rounded-2xl p-3 shadow-md"
    >
      <div className="mb-auto flex items-start justify-between">
        {ep.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ep.coverUrl} alt="" className="h-10 w-10 rounded-full object-cover grayscale" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-white/20" />
        )}
        <NothingToggle
          active={queued}
          onClick={toggle}
          ariaLabel={queued ? "Queued" : "Save for later"}
          className="!px-2 !py-1 bg-black/25 text-white"
        >
          {queued ? "✓" : "+"}
        </NothingToggle>
      </div>
      {ep.showTitle && (
        <Link
          href={ep.showId ? `/show/${ep.showId}` : `/search?q=${encodeURIComponent(ep.showTitle)}`}
          className="font-brand line-clamp-1 text-sm font-bold text-white hover:underline"
        >
          {ep.showTitle}
        </Link>
      )}
      <p className="line-clamp-1 text-xs text-white/70">{ep.title}</p>
    </li>
  );
}
