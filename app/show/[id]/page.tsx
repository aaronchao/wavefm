"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getShow } from "@/src/data/catalog/client";
import type { CatalogShow } from "@/src/data/catalog/types";
import { recordEngagement } from "@/src/data/repos/engagementRepo";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { inferCountry } from "@/src/core/geo/inferCountry";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { CommunityRecs } from "@/src/features/show/CommunityRecs";
import { GlobeBackdrop } from "@/src/features/show/GlobeBackdrop";
import { SimilarContent } from "@/src/features/show/SimilarContent";
import { TagEditor } from "@/src/features/show/TagEditor";
import { TopEpisodes } from "@/src/features/show/TopEpisodes";
import { CoverTile, NothingToggle, SettleIn } from "@/src/ui";

export default function ShowPage() {
  const { id } = useParams<{ id: string }>();
  const { data: show, isLoading } = useQuery({
    queryKey: ["catalog", "show", id],
    queryFn: () => getShow(id),
  });

  return (
    <main className="mx-auto w-full max-w-2xl p-4 pb-[calc(14rem+env(safe-area-inset-bottom))] sm:p-8 sm:pb-[calc(14rem+env(safe-area-inset-bottom))]">
      {isLoading && <p className="text-zinc-500">Loading…</p>}
      {!isLoading && !show && (
        <p className="text-zinc-500">
          Couldn&apos;t load this show right now — it may be unavailable.
        </p>
      )}
      {show && <ShowDetail show={show} />}
    </main>
  );
}

function ShowDetail({ show }: { show: CatalogShow }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void isSaved(show.id).then((v) => {
      if (!cancelled) setSaved(v);
    });
    return () => {
      cancelled = true;
    };
  }, [show.id]);

  // Best-effort, purely from the show's own text — see inferCountry's own
  // doc comment for exactly which scripts/signals it trusts and why it
  // returns null (no guess) for anything more ambiguous than that. Held
  // back from the globe until an episode is actually selected (below) —
  // revealing it the instant the page loads would spoil the "extra
  // information" as a reward for engaging, and just narrate over the page.
  const countryGuess = useMemo(() => inferCountry(show), [show]);
  const [revealed, setRevealed] = useState(false);

  // ONE_CLICK invariant for save
  function toggleSave() {
    const next = !saved;
    setSaved(next);
    void (next ? saveShow(show) : unsaveShow(show.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    );
  }

  // deep-link click = 'open' engagement (+1) — you were curious enough
  function onOpen() {
    void recordEngagement(show, "open");
  }

  return (
    <SettleIn className="flex flex-col gap-6">
      <GlobeBackdrop target={revealed ? countryGuess : null} />

      {revealed && countryGuess && (
        <p className="glass-panel inline-flex w-fit items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs text-foreground">
          📍 Likely produced in {countryGuess.name} — best guess from the show&apos;s own text.
        </p>
      )}

      {/* One glass card for the whole info block — plain text sitting
          directly over the globe backdrop (below) had real legibility
          problems once the camera flies in close; frosted glass keeps it
          readable regardless of what's behind it, by design. */}
      <div className="glass-panel flex flex-col gap-6 rounded-[1.75rem] p-5 shadow-lg">
        <div className="flex items-start gap-5">
          <CoverTile src={show.coverUrl} size={112} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{show.title}</h1>
            <p className="text-zinc-500">{show.author}</p>
            {show.categories.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {show.categories.slice(0, 4).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <NothingToggle
            active={saved}
            onClick={toggleSave}
            ariaLabel={saved ? "Saved ✓" : "Save"}
          >
            {saved ? "✓" : "+"}
          </NothingToggle>
        </div>

        <TagEditor showId={show.id} />

        <section>
          <h2 className="font-brand mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Listen on
          </h2>
          {/* icons only, one horizontal row — brand colour when a stored link
              exists, grayscale otherwise, plus an RSS copy for any-app import */}
          <OpenInLinks
            title={show.title}
            appleUrl={show.appleUrl}
            feedUrl={show.feedUrl}
            stored={show.platformLinks}
            showId={show.id}
            label=""
            size="md"
            onOpen={onOpen}
          />
        </section>

        {show.description && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              About
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-300">
              {show.description}
            </p>
          </section>
        )}
      </div>

      <TopEpisodes show={show} onEpisodeSelect={() => setRevealed(true)} />

      {/* Community-mined recs first (renders nothing until edges exist), then
          the live algorithmic Similar list as the always-there fallback. */}
      <CommunityRecs seedId={show.id} />

      <SimilarContent showId={show.id} />
    </SettleIn>
  );
}
