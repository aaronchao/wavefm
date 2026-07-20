"use client";

import { buildOpml, type OpmlFeed } from "@/src/core/opml";
import { getShow } from "@/src/data/catalog/client";
import { listSavedEpisodes } from "@/src/data/repos/savedEpisodesRepo";
import { listSaved } from "@/src/data/repos/savedShowsRepo";

/**
 * Gather everything the user follows into an OPML file and download it —
 * saved shows (feed URL in hand) plus the parent feeds of any queued
 * episodes (resolved by show id). Feed-level by nature, deduped by URL.
 * Returns the number of feeds written so the UI can confirm.
 */
export async function exportSubscriptionsOpml(): Promise<number> {
  const [saved, episodes] = await Promise.all([listSaved(), listSavedEpisodes()]);

  const feeds: OpmlFeed[] = [];
  for (const s of saved) {
    if (s.show.feedUrl) {
      feeds.push({ title: s.show.title, feedUrl: s.show.feedUrl, htmlUrl: s.show.appleUrl });
    }
  }

  // queued episodes carry no feed of their own — pull their parent show's
  const showIds = [...new Set(episodes.map((e) => e.showId).filter((x): x is string => !!x))];
  const parents = await Promise.all(showIds.map((id) => getShow(id)));
  for (const show of parents) {
    if (show?.feedUrl) {
      feeds.push({ title: show.title, feedUrl: show.feedUrl, htmlUrl: show.appleUrl });
    }
  }

  const xml = buildOpml(feeds);
  const unique = new Set(feeds.map((f) => f.feedUrl.trim()).filter(Boolean)).size;
  downloadText(xml, "wavr-subscriptions.opml", "text/x-opml");
  return unique;
}

function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
