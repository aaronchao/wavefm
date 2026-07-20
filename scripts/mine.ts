/* eslint-disable no-console */
import { createHash } from "node:crypto";
import {
  aliasesForShow,
  buildGazetteer,
  mineDocuments,
  normalize,
} from "@/src/core/mining";
import { getAdminSupabase } from "@/src/data/mining/admin";
import { harvestAll, type Seed } from "@/src/data/mining/harvest";

/**
 * The offline mining run (GitHub Actions cron). Reads the catalog + seeds from
 * Supabase, harvests community discussion, extracts scored Seed → Rec edges
 * with the pure core, and writes them back. Everything is best-effort: missing
 * secrets / empty catalog / dead upstream logs and exits 0 rather than failing
 * the workflow. Run with: `npx -y tsx scripts/mine.ts`.
 */

const HOT_POOL_FALLBACK = 50; // when few users have saved shows yet

type ShowRow = { id: string; title: string; language: string | null };

async function main(): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) {
    console.error("[mine] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping.");
    return;
  }

  // Register the sources (FK target for raw_documents), idempotent.
  await admin.from("mining_sources").upsert(
    [
      { id: "reddit", name: "Reddit", lang: "en", kind: "api" },
      { id: "douban", name: "豆瓣小组", lang: "zh", kind: "rss" },
    ],
    { onConflict: "id", ignoreDuplicates: true },
  );

  // 1. Known catalog → gazetteer (and sync the alias table).
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
    await admin.from("raw_documents").upsert(docRows, { onConflict: "id" });
  }

  // 5. Extract + aggregate → write edges.
  const edges = mineDocuments(docs, gaz);
  console.log(`[mine] ${edges.length} rec edges`);
  if (edges.length) {
    await admin.from("rec_edges").upsert(
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
  }
  console.log("[mine] done.");
}

main().catch((err) => {
  console.error("[mine] fatal:", err);
  process.exit(1);
});
