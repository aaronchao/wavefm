# Community recommendation mining

Sources recommendations from human community discussion (Reddit, 豆瓣小组, …)
instead of top charts. Offline pipeline → `rec_edges` → served instantly.

```
GitHub Actions cron ── harvest (Reddit + Douban/RSSHub) ── extract (pure core) ──▶ Supabase
   scripts/mine.ts                                          rec_edges (seed → rec, +evidence)
                                                                  │
   /api/recs/community?seed=  ◀──────────────────────────────────┘  (served in ~10ms)
```

## One-time setup

1. **Apply the schema.** Paste `supabase/migrations/003_community_mining.sql`
   into the Supabase SQL editor (same as the other migrations). Creates the
   pipeline tables; only the service role can write them, everyone can read
   `rec_edges` + `podcast_aliases`.

2. **Add GitHub Actions secrets** (repo → Settings → Secrets → Actions):
   | Secret | Required | Notes |
   |---|---|---|
   | `SUPABASE_URL` | yes | project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | yes | service role key (server-only; never client) |
   | `RSSHUB_BASE` | for Douban | your RSSHub instance, e.g. `https://rsshub.<you>.dev` |
   | `DOUBAN_GROUPS` | for Douban | comma-separated group ids to watch; Douban is off until set |
   | `REDDIT_CLIENT_ID` / `REDDIT_SECRET` | recommended | Reddit "script" app; anonymous fallback works but gets rate-limited from CI |

3. **(Recommended) Self-host RSSHub** — free on Vercel/Render. Douban's API is
   closed; RSSHub is how we read group topic feeds resiliently. A public
   instance works via `RSSHUB_BASE` but is rate-limited.

The workflow (`.github/workflows/mine.yml`) runs hourly and on manual dispatch.
Without secrets it logs and exits 0 — nothing breaks.

## Serving

`/api/recs/community?seed=<showId>` reads `rec_edges`. When the pipeline hasn't
produced edges for a seed yet, the app falls back to the live discussion path,
so the feature never renders worse than today.

## Roadmap

- **Wave 1 (now):** Reddit + Douban, precision-tuned in `/src/core/mining`.
- **Wave 2:** PTT, Dcard, LIHKG adapters (same `HarvestSource` interface).
- **Wave 3:** Xiaohongshu (RSSHub/aggregator only — best-effort), Discord
  (consent-based bot), Listen Notes (enrichment only).
- **Hardening:** persist `mentions` and roll up `rec_edges` via `pg_cron` so
  signal accumulates across runs (+ time decay), Simplified↔Traditional folding
  (OpenCC) once PTT/LIHKG land.
