"use client";

import { clipStart, pickIndex } from "@/src/core/preview";
import { getPreviewEpisodes } from "@/src/data/catalog/client";
import type { CatalogEpisode, CatalogShow } from "@/src/data/catalog/types";
import { player, type PreviewMeta } from "@/src/state/player";

/**
 * One-click preview actions. A show samples a random one of its ~10
 * newest episodes at a random spot; an episode plays itself at a random
 * spot. No audio -> the bar stays up with "listen in full" links, so a
 * blocked feed never turns into a dead click.
 */

export function previewShow(show: Pick<CatalogShow, "id" | "title" | "coverUrl" | "appleUrl">) {
  const meta: PreviewMeta = {
    title: show.title,
    coverUrl: show.coverUrl,
    searchTitle: show.title,
    appleUrl: show.appleUrl,
  };
  player.startLoading(meta);
  void getPreviewEpisodes(show.id).then((episodes) => {
    if (episodes.length === 0) return player.fail(meta);
    const episode = episodes[pickIndex(episodes.length, Math.random())];
    player.play(
      { ...meta, title: episode.title, showTitle: show.title },
      episode.audioUrl,
      clipStart(episode.durationSec, Math.random()),
    );
  });
}

export function previewEpisode(episode: CatalogEpisode) {
  const meta: PreviewMeta = {
    title: episode.title,
    showTitle: episode.showTitle,
    coverUrl: episode.coverUrl,
    searchTitle: episode.title,
    appleUrl: episode.appleUrl,
  };
  if (episode.audioUrl) {
    player.play(meta, episode.audioUrl, clipStart(episode.durationSec, Math.random()));
    return;
  }
  if (episode.showId) {
    // no direct audio from the catalog — sample the parent show's feed
    player.startLoading(meta);
    void getPreviewEpisodes(episode.showId).then((episodes) => {
      const match =
        episodes.find((e) => e.title === episode.title) ??
        episodes[pickIndex(episodes.length, Math.random())];
      if (!match) return player.fail(meta);
      player.play(
        { ...meta, title: match.title },
        match.audioUrl,
        clipStart(match.durationSec, Math.random()),
      );
    });
    return;
  }
  player.fail(meta);
}
