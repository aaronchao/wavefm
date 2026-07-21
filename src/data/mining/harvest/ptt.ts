import type { RawDoc } from "@/src/core/mining";
import { docLang, htmlToText, type HarvestSource, type Seed } from "./types";

/**
 * PTT (批踢踢) harvester — the Podcast board, parsed from the public web (no
 * API, over18 cookie only). Search finds threads about the seed; each thread
 * page is then fetched for its post body (where the recommended shows live).
 * Traditional Chinese, reachable from CI. Best-effort with a hard timeout:
 * any failure returns null / skips a thread.
 */

const TIMEOUT_MS = 6000;
const PTT_CAP = 6; // threads whose bodies we fetch per seed (politeness)
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": BROWSER_UA, Cookie: "over18=1" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** PURE: thread links + titles from a PTT board search page. */
export function parsePttSearch(html: string): { href: string; title: string }[] {
  const rows: { href: string; title: string }[] = [];
  const re = /<div class="title">\s*<a href="(\/bbs\/Podcast\/[^"]+)">([^<]+)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) rows.push({ href: m[1], title: m[2].trim() });
  return rows;
}

/** PURE: the post body + author from a PTT thread page. */
export function parsePttThread(html: string): { body: string; author: string } {
  const author =
    html.match(/作者<\/span><span class="article-meta-value">([^< (]+)/)?.[1]?.trim() ?? "";
  // main-content up to the signature line (drops the push-comment section)
  const main =
    html.match(/<div id="main-content"[^>]*>([\s\S]*?)<span class="f2">※ 發信站/)?.[1] ??
    html.match(/<div id="main-content"[^>]*>([\s\S]*?)<\/div>/)?.[1] ??
    "";
  return { body: htmlToText(main), author };
}

const contains = (hay: string, needle: string) =>
  hay.toLowerCase().includes(needle.trim().toLowerCase());

async function harvest(seed: Seed): Promise<RawDoc[] | null> {
  // PTT is a Traditional-Chinese (Taiwan) board — skip non-Chinese seeds so we
  // don't waste fetches (and hammer the board) on shows it won't carry.
  if (!/\p{sc=Han}/u.test(seed.title)) return [];
  const searchHtml = await fetchText(
    `https://www.ptt.cc/bbs/Podcast/search?q=${encodeURIComponent(seed.title)}`,
  );
  if (searchHtml === null) return null;
  const matched = parsePttSearch(searchHtml)
    .filter((r) => contains(r.title, seed.title))
    .slice(0, PTT_CAP);
  if (matched.length === 0) return [];

  const docs = await Promise.all(
    matched.map(async (r): Promise<RawDoc> => {
      const html = await fetchText(`https://www.ptt.cc${r.href}`);
      const { body, author } = html ? parsePttThread(html) : { body: "", author: "" };
      return {
        id: `ptt:${r.href}`,
        source: "ptt",
        lang: docLang(`${r.title} ${body}`),
        title: r.title,
        body,
        author: author ? `ptt:${author}` : `ptt:${r.href}`,
        url: `https://www.ptt.cc${r.href}`,
      };
    }),
  );
  return docs;
}

export const pttSource: HarvestSource = { id: "ptt", mode: "seeded", harvest };
