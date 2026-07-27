import {
  addEpisodeTag,
  listEpisodeTags,
  removeEpisodeTag,
} from "./episodeTagsRepo";
import { addShowTag, listShowTags, normalizeTag, removeShowTag } from "./showTagsRepo";

/**
 * "Edit Tag" mutation (Library): renaming a tag must cascade to every Show
 * AND Episode it's attached to — not just update local state. This walks
 * every tagged show/episode and re-points it at the new tag via the existing
 * add/remove primitives, each of which performs a real Supabase
 * upsert/delete (or the localStorage fallback when signed out) — so the
 * rename is a genuine database mutation, merge-safe if the target tag
 * already exists on some of those rows (upsert with `ignoreDuplicates`).
 */
export async function renameTagEverywhere(
  oldTag: string,
  rawNewTag: string,
): Promise<void> {
  const newTag = normalizeTag(rawNewTag);
  if (!newTag || newTag === oldTag) return;

  const [showMap, episodeMap] = await Promise.all([listShowTags(), listEpisodeTags()]);
  const showIds = Object.entries(showMap)
    .filter(([, tags]) => tags.includes(oldTag))
    .map(([id]) => id);
  const episodeIds = Object.entries(episodeMap)
    .filter(([, tags]) => tags.includes(oldTag))
    .map(([id]) => id);

  await Promise.all([
    ...showIds.map((id) =>
      addShowTag(id, newTag).then(() => removeShowTag(id, oldTag)),
    ),
    ...episodeIds.map((id) =>
      addEpisodeTag(id, newTag).then(() => removeEpisodeTag(id, oldTag)),
    ),
  ]);
}
