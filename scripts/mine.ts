import { createHash } from "node:crypto";
import {
  aliasesForShow,
  buildGazetteer,
  mineDocuments,
  normalize,
} from "@/src/core/mining";
import { getAdminSupabase } from "@/src/data/mining/admin";
import { harvestAll, type Seed } from "@/src/data/mining/harvest";
import {
  itunesSearch,
  itunesTopChartShows,
  piTrendingShows,
} from "@/src/data/catalog/server";
import type { CatalogShow } from "@/src/data/catalog/types";

/**
 * The offline mining run (GitHub Actions cron). Reads the catalog + seeds from
 * Supabase, harvests community discussion, extracts scored Seed → Rec edges
 * with the pure core, and writes them back. Everything is best-effort: missing
 * secrets / empty catalog / dead upstream logs and exits 0 rather than failing
 * the workflow. Run with: `npx -y tsx scripts/mine.ts`.
 */

const HOT_POOL_FALLBACK = 50; // when few users have saved shows yet

type ShowRow = { id: string; title: string; language: string | null };

// Topical searches to widen the gazetteer (ZH first → cn storefront, then EN).
const WIDEN_ZH = ["播客", "故事", "访谈", "科技", "商业", "历史", "读书", "情感"];
const WIDEN_EN = ["podcast", "storytelling", "true crime", "comedy", "society culture", "technology", "interview", "science"];

/**
 * Widen the catalog so community discussion has known shows to connect. The
 * extractor only draws an edge between two shows in the gazetteer, so a
 * 59-show catalog almost never sees ≥2 of its shows co-recommended in a random
 * thread. Pulling a few hundred popular podcasts (Apple US+CN charts, PI
 * trending, topical searches) into `shows` massively raises the hit rate.
 * Best-effort: a dead upstream just adds fewer shows.
 */
async function widenCatalog(
  admin: NonNullable<ReturnType<typeof getAdminSupabase>>,
): Promise<void> {
  const lists = await Promise.all([
    itunesTopChartShows("us"),
    itunesTopChartShows("cn"),
    piTrendingShows(),
    ...WIDEN_ZH.map((q) => itunesSearch(q, "cn")),
    ...WIDEN_EN.map((q) => itunesSearch(q)),
  ]);
  const byId = new Map<string, CatalogShow>();
  for (const list of lists) {
    for (const s of list ?? []) if (!byId.has(s.id)) byId.set(s.id, s);
  }
  const pool = [...byId.values()];
  if (pool.length === 0) return;

  const rows = pool.map((s) => ({
    id: s.id,
    itunes_id: s.source === "itunes" ? s.id : null,
    feed_url: s.feedUrl ?? null,
    title: s.title,
    author: s.author || null,
    description: s.description ?? null,
    categories: s.categories,
    cover_url: s.coverUrl ?? null,
    platform_links: s.appleUrl ? { apple: s.appleUrl } : {},
    updated_at: new Date().toISOString(),
  }));
  let wrote = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await admin.from("shows").upsert(chunk, { onConflict: "id" });
    if (error) console.error(`[mine] shows upsert failed: ${error.message}`);
    else wrote += chunk.length;
  }
  console.log(`[mine] widened catalog: ${wrote}/${pool.length} popular shows written`);
}

async function main(): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) {
    console.error("[mine] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping.");
    return;
  }

  // Register the sources (FK target for raw_documents), idempotent. This is
  // also our write-permission probe: if it fails, the key can't write and
  // nothing downstream will persist — almost always the anon key in the
  // SUPABASE_SERVICE_ROLE_KEY secret instead of the real service_role key.
  const { error: writeErr } = await admin.from("mining_sources").upsert(
    [
      { id: "hackernews", name: "Hacker News", lang: "en", kind: "api" },
      { id: "v2ex", name: "V2EX", lang: "zh", kind: "api" },
      { id: "ptt", name: "PTT", lang: "zh", kind: "forum" },
      { id: "reddit", name: "Reddit", lang: "en", kind: "api" },
      { id: "douban", name: "豆瓣小组", lang: "zh", kind: "rss" },
    ],
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (writeErr) {
    console.error(
      `[mine] ⚠️ WRITE FAILED — is SUPABASE_SERVICE_ROLE_KEY the *service_role* key (not the anon/publishable key)? Postgres said: ${writeErr.message}`,
    );
  } else {
    console.log("[mine] write check OK (service-role key can write)");
  }

  // 1. Widen the catalog, then build the gazetteer from everything cached.
  await widenCatalog(admin);
  const { data: showData } = await admin.from("shows").select("id,title,language");
  const shows = (showData ?? []) as ShowRow[];
  if (shows.length === 0) {
    console.error("[mine] no cached shows yet — nothing to match against.");
    return;
  }
  const aliases = shows.flatMap((s) => aliasesForShow(s.id, s.title, s.language ?? undefined));
  const gaz = buildGazetteer(aliases);
  console.log(`[mine] gazetteer: ${aliases.length} aliases / ${shows.length} shows`);

  await admin.from("podcast_aliases").upsert(
    aliases.map((a) => ({
      show_id: a.showId,
      alias: a.alias,
      alias_norm: normalize(a.alias),
      lang: a.lang ?? null,
      is_generic: a.generic ?? false,
    })),
    { onConflict: "show_id,alias_norm", ignoreDuplicates: true },
  );

  // 2. Seeds: everything users saved + a hot-pool fallback so cold starts work.
  const { data: savedData } = await admin.from("saved_shows").select("show_id").limit(1000);
  const savedIds = new Set((savedData ?? []).map((r) => (r as { show_id: string }).show_id));
  const seeds: Seed[] = shows.filter((s) => savedIds.has(s.id)).map((s) => ({ showId: s.id, title: s.title }));
  if (seeds.length < 20) {
    for (const s of shows.slice(0, HOT_POOL_FALLBACK)) {
      if (!savedIds.has(s.id)) seeds.push({ showId: s.id, title: s.title });
    }
  }
  console.log(`[mine] ${seeds.length} seeds`);

  // 3. Harvest → dedup.
  const docs = await harvestAll(seeds);
  console.log(`[mine] harvested ${docs.length} documents`);

  // 4. Persist raw documents (dedup by content hash to respect the unique idx).
  const seenHash = new Set<string>();
  const docRows = [];
  for (const d of docs) {
    const contentHash = createHash("sha1").update(`${d.title}\n${d.body}`).digest("hex");
    if (seenHash.has(contentHash)) continue;
    seenHash.add(contentHash);
    docRows.push({
      id: d.id,
      source_id: d.source,
      url: d.url ?? null,
      content_hash: contentHash,
      title: d.title,
      body: d.body,
      author_hash: d.author,
      lang: d.lang,
      posted_at: d.postedAt ?? null,
      processed_at: new Date().toISOString(),
    });
  }
  if (docRows.length) {
    const { error } = await admin.from("raw_documents").upsert(docRows, { onConflict: "id" });
    if (error) console.error(`[mine] raw_documents upsert failed: ${error.message}`);
  }

  // 5. Extract + aggregate → write edges.
  const edges = mineDocuments(docs, gaz);
  console.log(`[mine] ${edges.length} rec edges`);
  if (edges.length) {
    const { error } = await admin.from("rec_edges").upsert(
      edges.map((e) => ({
        seed_show_id: e.seedShowId,
        rec_show_id: e.recShowId,
        score: e.score,
        mention_count: e.mentionCount,
        author_count: e.authorCount,
        sentiment_avg: e.sentimentAvg,
        evidence: e.evidence,
        computed_at: new Date().toISOString(),
      })),
      { onConflict: "seed_show_id,rec_show_id" },
    );
    if (error) console.error(`[mine] rec_edges upsert failed: ${error.message}`);
  }
  console.log("[mine] done.");
}

main().catch((err) => {
  console.error("[mine] fatal:", err);
  process.exit(1);
});
