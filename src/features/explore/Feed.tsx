"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Cluster } from "@/src/core/recommend";
import type { CatalogShow } from "@/src/data/catalog/types";
import { recordEngagement } from "@/src/data/repos/engagementRepo";
import { bumpImpressions } from "@/src/data/repos/impressionsRepo";
import { saveShow } from "@/src/data/repos/savedShowsRepo";
import { Card, Chip, CoverTile, SettleIn } from "@/src/ui";
import { useRecommendations } from "./useRecommendations";

export function Feed() {
  const { clusters, showsById, isLoading, refresh } = useRecommendations();

  // fatigue signal: everything rendered this pass counts as an impression
  useEffect(() => {
    if (clusters.length > 0) {
      bumpImpressions(clusters.flatMap((c) => c.items.map((i) => i.show.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters.map((c) => c.items.map((i) => i.show.id).join()).join("|")]);

  if (isLoading) {
    return <p className="text-zinc-500">Warming up your recommendations…</p>;
  }
  if (clusters.length === 0) {
    return (
      <p className="text-zinc-500">
        Nothing to recommend yet — save a show or two in Search and check
        back.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {clusters.map((c) => (
        <ClusterSection key={c.id} cluster={c} showsById={showsById} onAction={refresh} />
      ))}
    </div>
  );
}

function ClusterSection({
  cluster,
  showsById,
  onAction,
}: {
  cluster: Cluster;
  showsById: Map<string, CatalogShow>;
  onAction: () => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-pill bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
          {cluster.why}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {cluster.items.map((item) => {
          const show = showsById.get(item.show.id);
          return show ? (
            <FeedCard key={item.show.id} show={show} onAction={onAction} />
          ) : null;
        })}
      </div>
    </section>
  );
}

function FeedCard({
  show,
  onAction,
}: {
  show: CatalogShow;
  onAction: () => void;
}) {
  // ONE_CLICK invariant: save / like / not-for-me are single clicks
  async function act(kind: "save" | "like" | "block") {
    if (kind === "save") {
      await saveShow(show);
    } else {
      await recordEngagement(show, kind);
    }
    onAction();
  }

  return (
    <SettleIn>
      <Card className="flex items-center gap-4">
        <Link href={`/show/${show.id}`} className="shrink-0">
          <CoverTile src={show.coverUrl} size={64} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/show/${show.id}`} className="hover:underline">
            <p className="truncate font-semibold">{show.title}</p>
          </Link>
          <p className="truncate text-sm text-zinc-500">{show.author}</p>
          {show.categories.length > 0 && (
            <p className="truncate text-xs text-zinc-400">
              {show.categories.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <Chip onClick={() => void act("save")}>Save</Chip>
          <Chip onClick={() => void act("like")} aria-label="Like">
            👍
          </Chip>
          <Chip onClick={() => void act("block")} aria-label="Not for me">
            🚫
          </Chip>
        </div>
      </Card>
    </SettleIn>
  );
}
