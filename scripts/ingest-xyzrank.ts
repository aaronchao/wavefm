import { getAdminSupabase } from "@/src/data/mining/admin";
import {
  xyzrankChartLive,
  xyzrankHotEpisodesLive,
  xyzrankNewEpisodesLive,
  xyzrankNewPodcastsLive,
} from "@/src/data/buzz/xyzrank";

/**
 * Refreshes the `xyzrank_cache` table (GitHub Actions cron, not Vercel) —
 * xyzrank.com sits behind Cloudflare bot protection that blocks Vercel's
 * outbound IPs specifically (confirmed: an identical request succeeds from
 * a residential IP, fails in production), so the app can't fetch it live.
 * GitHub's runners get a fresh IP each run, which may or may not dodge the
 * same block — either way, a stale cache from the last successful run beats
 * an empty section, so a failed board here just leaves its existing row
 * untouched rather than clearing it. Run with: `npx -y tsx scripts/ingest-xyzrank.ts`.
 */

const BOARDS: { board: string; fetch: () => Promise<unknown | null> }[] = [
  { board: "podcasts", fetch: xyzrankChartLive },
  { board: "new-podcasts", fetch: xyzrankNewPodcastsLive },
  { board: "episodes", fetch: xyzrankHotEpisodesLive },
  { board: "new-episodes", fetch: xyzrankNewEpisodesLive },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Observed live (twice, reproducibly): /api/podcasts specifically fails
 * every run while its three sibling endpoints succeed in the same run —
 * not the broad Vercel-style block (GitHub's IP clearly reaches xyzrank
 * fine), something narrower to that one endpoint or request slot. A short
 * retry is cheap insurance against a transient cause without needing to
 * pin down which; if it's a hard per-endpoint block, this just costs one
 * extra request before falling back to leaving that board's cache stale.
 */
async function fetchWithRetry(fetch: () => Promise<unknown | null>): Promise<unknown | null> {
  const first = await fetch();
  if (first) return first;
  await sleep(3000);
  return fetch();
}

async function main() {
  const admin = getAdminSupabase();
  if (!admin) {
    console.log("[ingest-xyzrank] no SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY — skipping.");
    return;
  }

  let succeeded = 0;
  for (const { board, fetch } of BOARDS) {
    const data = await fetchWithRetry(fetch);
    if (!data) {
      console.error(`[ingest-xyzrank] ${board}: fetch failed (blocked or empty) — leaving cache untouched`);
      continue;
    }
    const { error } = await admin
      .from("xyzrank_cache")
      .upsert({ board, payload: data, fetched_at: new Date().toISOString() }, { onConflict: "board" });
    if (error) {
      console.error(`[ingest-xyzrank] ${board}: write failed: ${error.message}`);
      continue;
    }
    succeeded++;
    console.log(`[ingest-xyzrank] ${board}: OK (${Array.isArray(data) ? data.length : 0} entries)`);
  }
  console.log(`[ingest-xyzrank] done — ${succeeded}/${BOARDS.length} boards refreshed.`);
}

main().catch((err) => {
  console.error("[ingest-xyzrank] fatal:", err);
  process.exit(1);
});
