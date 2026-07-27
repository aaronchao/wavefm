"use client";

import { clipStart, middleFraction, pickIndex } from "@/src/core/preview";
import { getPreviewEpisodes, getRankedEpisodes } from "@/src/data/catalog/client";
import type {
  CatalogEpisode,
  CatalogShow,
  RankedEpisodeItem,
} from "@/src/data/catalog/types";
import { player, type PreviewMeta } from "@/src/state/player";

/**
 * One-click preview actions. A show samples a random one of its ~10
 * newest episodes at a random spot; an episode plays itself at a random
 * spot. No audio -> the bar stays up with "listen in full" links, so a
 * blocked feed never turns into a dead click.
 */

export function previewShow(
  show: Pick<
    CatalogShow,
    "id" | "title" | "coverUrl" | "appleUrl" | "feedUrl" | "platformLinks"
  >,
) {
  const meta: PreviewMeta = {
    title: show.title,
    coverUrl: show.coverUrl,
    searchTitle: show.title,
    appleUrl: show.appleUrl,
    feedUrl: show.feedUrl,
    platformLinks: show.platformLinks,
    showId: show.id,
  };
  player.startLoading(meta);
  // rss- shows aren't in any catalog — their feed URL rides along
  void getPreviewEpisodes(show.id, show.feedUrl).then((episodes) => {
    if (episodes.length === 0) return player.fail(meta);
    const episode = episodes[pickIndex(episodes.length, Math.random())];
    player.play(
      { ...meta, title: episode.title, showTitle: show.title },
      episode.audioUrl,
      clipStart(episode.durationSec, Math.random()),
    );
  });
}

/**
 * One-click "play the middle of the top episode" for a recommended show.
 * Fetches the show's discussion-first episode ranking and samples a random
 * middle section of the #1 episode — the discovery page's headline action.
 * A blocked feed keeps the bar up with "listen in full" links.
 */
export function previewShowTopEpisodeMiddle(
  show: Pick<
    CatalogShow,
    "id" | "title" | "coverUrl" | "appleUrl" | "feedUrl" | "platformLinks"
  >,
) {
  const meta: PreviewMeta = {
    title: show.title,
    coverUrl: show.coverUrl,
    searchTitle: show.title,
    appleUrl: show.appleUrl,
    feedUrl: show.feedUrl,
    platformLinks: show.platformLinks,
    showId: show.id,
  };
  player.startLoading(meta);
  void getRankedEpisodes(show.id).then((eps) => {
    const top = eps.find((e) => e.audioUrl);
    if (!top?.audioUrl) return player.fail(meta);
    playMiddle({ ...meta, title: top.title, showTitle: show.title }, top);
  });
}

/** Play a random middle section of one already-ranked episode. */
export function previewRankedEpisode(
  item: RankedEpisodeItem,
  show: Pick<CatalogShow, "id" | "title" | "coverUrl" | "appleUrl" | "feedUrl" | "platformLinks">,
) {
  const meta: PreviewMeta = {
    title: item.title,
    showTitle: show.title,
    coverUrl: show.coverUrl,
    searchTitle: item.title,
    appleUrl: show.appleUrl,
    feedUrl: show.feedUrl,
    platformLinks: show.platformLinks,
    showId: show.id,
  };
  if (!item.audioUrl) return player.fail(meta);
  playMiddle(meta, item);
}

/** Shared: seek to a random middle fraction; seconds are a CDN fallback. */
function playMiddle(meta: PreviewMeta, item: Pick<RankedEpisodeItem, "audioUrl" | "durationSec">) {
  if (!item.audioUrl) return player.fail(meta);
  const fraction = middleFraction(Math.random());
  const startAt = item.durationSec ? Math.floor(item.durationSec * fraction) : 0;
  player.play(meta, item.audioUrl, startAt, fraction);
}

export function previewEpisode(episode: CatalogEpisode) {
  const meta: PreviewMeta = {
    title: episode.title,
    showTitle: episode.showTitle,
    coverUrl: episode.coverUrl,
    searchTitle: episode.title,
    appleUrl: episode.appleUrl,
    showId: episode.showId,
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
