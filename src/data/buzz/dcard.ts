import type { BuzzInput } from "@/src/core/recommend";
import type { EvidenceItem } from "@/src/data/catalog/types";

/**
 * Dcard discussion via its public post search — a large Taiwanese social
 * forum, great for zh-Hant community chatter about shows. Server-side only,
 * cached per title. Returns the mention count and the actual posts (title +
 * link). Dcard rate-limits / bot-filters aggressively, so this is strictly
 * best-effort: any failure returns null and the signal is simply skipped.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60;

type DcardPost = { id?: number; title?: string; forumAlias?: string };

async function search(title: string): Promise<DcardPost[] | null> {
  const q = encodeURIComponent(title.trim());
  try {
    const res = await fetch(
      `https://www.dcard.tw/service/api/v2/search/posts?query=${q}&limit=15`,
      {
        next: { revalidate: REVALIDATE_SECONDS },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as DcardPost[] | { posts?: DcardPost[] };
    return Array.isArray(json) ? json : (json.posts ?? []);
  } catch {
    return null;
  }
}

function relevant(posts: DcardPost[], title: string): DcardPost[] {
  const needle = title.trim().toLowerCase();
  return posts.filter((p) => (p.title ?? "").toLowerCase().includes(needle));
}

export async function dcardBuzz(title: string): Promise<BuzzInput | null> {
  const posts = await search(title);
  if (posts === null) return null;
  const mentions = relevant(posts, title).length;
  if (mentions === 0) return null;
  return { dcardMentions: mentions };
}

/** Buzz + the top few real Dcard posts (for readable discussion evidence). */
export async function dcardDiscussion(
  title: string,
): Promise<{ buzz: BuzzInput; evidence: EvidenceItem[] } | null> {
  const posts = await search(title);
  if (posts === null) return null;
  const matched = relevant(posts, title);
  if (matched.length === 0) return null;
  const evidence: EvidenceItem[] = matched
    .filter((p) => p.title && p.id)
    .slice(0, 2)
    .map((p) => ({
      source: "Dcard",
      text: p.title!,
      url: p.forumAlias
        ? `https://www.dcard.tw/f/${p.forumAlias}/p/${p.id}`
        : `https://www.dcard.tw/p/${p.id}`,
    }));
  return { buzz: { dcardMentions: matched.length }, evidence };
}
