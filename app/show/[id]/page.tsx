"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { platformLinks } from "@/src/core/links";
import { getShow } from "@/src/data/catalog/client";
import type { CatalogShow } from "@/src/data/catalog/types";
import { recordEngagement } from "@/src/data/repos/engagementRepo";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { RatingBadges } from "@/src/features/show/RatingBadges";
import { SimilarContent } from "@/src/features/show/SimilarContent";
import { TopEpisodes } from "@/src/features/show/TopEpisodes";
import { Chip, CoverTile, SettleIn } from "@/src/ui";

export default function ShowPage() {
  const { id } = useParams<{ id: string }>();
  const { data: show, isLoading } = useQuery({
    queryKey: ["catalog", "show", id],
    queryFn: () => getShow(id),
  });

  return (
    <main className="mx-auto w-full max-w-2xl p-4 pb-40 sm:p-8 sm:pb-40">
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

  // ONE_CLICK invariant for save / like / not-for-me
  function toggleSave() {
    const next = !saved;
    setSaved(next);
    void (next ? saveShow(show) : unsaveShow(show.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    );
  }

  const links = platformLinks(show.title, {
    apple: show.appleUrl,
  });

  // deep-link click = 'open' engagement (+1) — you were curious enough
  function onOpen() {
    void recordEngagement(show, "open");
  }

  return (
    <SettleIn className="flex flex-col gap-6">
      <div className="flex items-start gap-5">
        <CoverTile src={show.coverUrl} size={112} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{show.title}</h1>
          <p className="text-zinc-500">{show.author}</p>
          {show.categories.length > 0 && (
            <p className="mt-1 text-xs text-zinc-400">
              {show.categories.slice(0, 4).join(" · ")}
            </p>
          )}
          <div className="mt-2">
            <RatingBadges showId={show.id} title={show.title} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={saved} onClick={toggleSave}>
          {saved ? "Saved ✓" : "Save"}
        </Chip>
        <Chip onClick={() => void recordEngagement(show, "like")} aria-label="Like">
          👍 Like
        </Chip>
        <Chip onClick={() => void recordEngagement(show, "block")} aria-label="Not for me">
          🚫 Not for me
        </Chip>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Listen on
        </h2>
        <div className="flex flex-wrap gap-2">
          {links.map((link) =>
            link.url ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onOpen}
                className="rounded-pill bg-surface px-3 py-1.5 text-sm font-medium hover:opacity-80"
              >
                {link.label}
                {link.isSearch ? " ↗" : ""}
              </a>
            ) : (
              // missing platform = dimmed chip, never an error (Section 6)
              <span
                key={link.id}
                aria-disabled
                className="cursor-not-allowed rounded-pill bg-surface px-3 py-1.5 text-sm font-medium opacity-40"
              >
                {link.label}
              </span>
            ),
          )}
        </div>
      </section>

      {show.description && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            About
          </h2>
          <p className="whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-300">
            {show.description}
          </p>
        </section>
      )}

      <TopEpisodes show={show} />

      <SimilarContent showId={show.id} />
    </SettleIn>
  );
}
