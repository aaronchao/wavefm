# Wavr — Refinement Log

A living backlog of improvements, known limitations, and ideas. This is the
place to capture "we should make X better someday" so it isn't lost.

## How to use this

- Add an item under the right section with a checkbox and a priority tag.
- Keep each item **actionable**: what to change, and why it matters.
- When you pick something up, check it off (or move it to a PR).
- `P1` = user-visible / correctness / cheap win · `P2` = worthwhile ·
  `P3` = nice-to-have / larger effort.
- Anything that would break a core rule (`WEB_ONLY`, `FREE`,
  `PROXY_EXTERNAL_CALLS`, `PURE_CORE`) belongs in **Deferred**, not here,
  unless we're consciously revisiting the rule.

Last updated: 2026-07-13.

---

## 0. Open deployment follow-ups (hand-off items)

- [ ] **P1 — Vercel env vars.** Add `LISTEN_NOTES_API_KEY`,
  `XIAOYUZHOU_ACCESS_TOKEN`, `XIAOYUZHOU_REFRESH_TOKEN` (and optional
  `PODCAST_INDEX_API_KEY` / `PODCAST_INDEX_API_SECRET`) in Vercel →
  Production, then redeploy. Until set, those signal providers silently
  no-op.
- [x] **P1 — Supabase migration.** ~~Run `002_collections.sql`~~ Applied
  2026-07-13 via MCP (`saved_episodes` live with RLS; advisors clean on
  it). Listen-later now syncs for signed-in users.
- [ ] **P2 — `wavr.is-a.dev` custom domain.** PR to `is-a-dev/register`
  with `domains/wavr.json` (CNAME → `cname.vercel-dns.com`) and
  `domains/_vercel.wavr.json` (TXT `vc-domain-verify=…`). Domain already
  added on the Vercel project side.
- [ ] **P2 — Rotate the pasted tokens.** The Listen Notes key and 小宇宙
  tokens were shared in chat; rotate them once everything's confirmed.

---

## 1. Recommendation quality

- [x] **P2 — Fuzzy title matching for buzz sources.** Done 2026-07-17.
  Shared `normalizeForMatch` / `titlesMatch` (`src/data/buzz/match.ts`,
  unit-tested) strips punctuation, drops podcast/radio/fm/播客/电台
  suffixes + a dangling article, preserves CJK; wired into xyzrank,
  listennotes, xiaoyuzhou matching.
- [x] **P2 — Weights now live in one config.** Done 2026-07-17.
  `src/core/recommend/weights.ts` centralizes the feed/similar/topPicks
  weights (values unchanged; tests confirm no behavior drift). Tuning is
  now a one-file edit. Still open: revisit the actual values once there's
  real engagement data.
- [ ] **P2 — Blocked shows still cost candidate slots.** `recommend()`
  filters blocked/saved after fetching; a heavily-blocked user gets a
  thinner feed. Consider over-fetching candidates proportional to the
  block count.
- [ ] **P3 — Interest picker is fixed-list only.** Users can only pick
  from `defaultTopics()`. Add free-text / search-to-add an interest (any
  catalog term becomes a seed), and a way to re-open onboarding from
  Settings.
- [ ] **P3 — TF-IDF ceiling.** Cosine over TF-IDF is transparent but
  shallow. A local embeddings model (e.g. a small quantized sentence
  encoder bundled client-side) could sharpen similarity while staying
  free + on-device. Prototype before committing — bundle size matters.

## 2. Data sources & signals

> **Live signal audit — 2026-07-17 (corrected).** Tested the key-gated
> providers with the **literal** credentials from the Mac:
> - **Listen Notes:** real key → **HTTP 200**. Valid and working. ✅
> - **小宇宙:** literal refresh token → **HTTP 200**, minting a fresh
>   access token — which exercises exactly the server's refresh path
>   (`/app_auth_tokens.refresh` with `x-jike-device-id: wavr-personal`,
>   confirming the device-id is NOT a binding blocker). Access-then-refresh
>   flow works. ✅
> - **Working, no auth:** Apple charts, 中文播客榜 (xyzrank), episode
>   recency/count, Douban. Reddit still unverified on Vercel (below).
>
> **Correction:** earlier 401s were a *test artifact*, not bad
> credentials. `vercel env pull` masks Sensitive values as the literal
> string `[SENSITIVE]`, so `source .env.prod` set every var to
> `[SENSITIVE]` and we were sending that as the token/key. The values
> stored in Vercel (entered verbatim in the dashboard) and read by the
> app via `process.env` are unaffected. Production very likely works for
> both providers; definitive confirmation needs a prod-side check (runtime
> logs or the live app), since the pulled file can't reveal the stored
> value.

- [ ] **P1 — Reddit blocks datacenter IPs.** `reddit.com/search.json`
  frequently 403s from Vercel's IPs, so the Reddit buzz signal may be
  quietly absent in production. Verify in prod; if blocked, either drop it
  or route through a lightweight allowed proxy / use the OAuth app API.
- [ ] **P2 — Confirm 小宇宙 + Listen Notes resolve in prod.** Credentials
  proven valid (2026-07-17). Confirm the deployed functions actually
  return data — read Vercel runtime logs for `xiaoyuzhouBuzz` /
  `listenNotesBuzz`, or hit a prod `/api/catalog/similar` and look for a
  Listen-Score / 小宇宙 "why". If a stored value was truncated on entry,
  re-paste it in the dashboard (paste is mangle-proof; the CLI/`source`
  path is not).
- [x] **P2 — Make 小宇宙 refresh-first.** Done 2026-07-17. `xiaoyuzhouBuzz`
  now refreshes up front when no access token is present, so a valid
  refresh token alone is enough.
- [ ] **P2 — Token refresh doesn't persist.** The refreshed 小宇宙 access
  token is cached in module memory, so it's lost on each serverless cold
  start (re-refresh every time). Consider stashing the latest access token
  in a Supabase row (server-only) so warm + cold invocations share it.
- [ ] **P2 — Listen Notes free-tier quota.** Only finalists are queried
  and cached 7 days, but the free plan is small. Add usage awareness (log
  quota headers) and a hard monthly cap / kill-switch so we never block on
  it.
- [ ] **P2 — Ratings scrapers are fragile.** Douban/Xiaoyuzhou rating
  adapters parse public pages; selectors rot. Add a tiny "did any rung
  return a number this week?" health signal so silent breakage is visible.
- [ ] **P3 — Direct platform deep-links.** Spotify / YouTube Music / 小宇宙
  chips are *search* URLs. Resolve real show URLs when possible (Spotify
  API, YouTube search API, 小宇宙 id) and store them in
  `shows.platformLinks`; keep search as the fallback.
- [ ] **P3 — Podparley-style discussion depth.** We approximate "quality
  discussion" with counts. Could enrich with sentiment / recency of
  threads, or pull a couple of representative quotes for the "why".

## 3. Collection, playback & sync

- [x] **P1 — Preview clips need HTTP Range.** Done 2026-07-13. The 30s
  window is now anchored to the *actual* playback position (via the
  `seeked` event, gated so a pre-seek `timeupdate` can't anchor early), so
  a Range-capable CDN plays the random offset and a no-Range CDN plays a
  clean 0:00–0:30 clip labelled "30s preview from the start". Verified in
  headless Chromium against both a Range-serving and a no-Range fixture.
- [ ] **P2 — Auto-track listen progress from previews.** `saved_episodes`
  has `status` + `position_sec`, but only the manual "Done?" toggle writes
  them. Wire the preview player to mark an episode `in_progress` and record
  `position_sec` when the user plays it, so "resume" reflects reality.
- [ ] **P2 — External player progress sync.** Apple/Spotify/YouTube expose
  no progress API. Two real paths: (a) pull *played episodes* from 小宇宙
  with the user's token to reconcile finished/queued state; (b) support
  the open **gpodder.net** sync standard for players like AntennaPod.
  Both are meaningful features — scope separately.
- [ ] **P3 — "New episode" badge is best-effort.** It compares each saved
  show's latest `lastEpisodeAt` (capped at 20 shows, RSS-enriched) against
  `savedAt`. No unread count, no per-episode list. A proper "new episodes"
  inbox (fetch recent items per saved feed) would be the real feature.

## 4. UX & accessibility

- [ ] **P2 — Nested interactive elements.** Cards are `role="button"`
  (play preview) with a `Link` and `Chip`s inside that `stopPropagation`.
  It works but is an a11y smell (interactive-in-interactive). Consider a
  dedicated play button + separate navigation target, and run an axe pass.
- [x] **P2 — Custom error boundary.** Done 2026-07-17. `app/error.tsx`
  gives a friendly "Something hiccuped" fallback with Try again / Go home.
- [ ] **P3 — Responsive audit for new surfaces.** Library, Top Picks, and
  the preview bar were built desktop-first with `pb-40` spacing. Do a real
  mobile pass (small screens, the fixed player bar overlapping content,
  long titles/CJK wrapping).
- [ ] **P3 — i18n.** Copy is mixed English + Chinese ad hoc. If non-English
  usage grows, adopt a light i18n layer instead of inline strings.

## 5. Reliability & degradation

- [ ] **P2 — Harden remaining client parsers.** `getShow` returns
  `json.show ?? null`; the list parsers now coerce arrays. Audit any other
  spot that trusts an upstream body shape (ratings client, repos) the same
  way, so a malformed 200 can never crash render.
- [ ] **P2 — Surface "degraded" honestly.** Several routes return
  `degraded: true` but the UI mostly just shows empty. A subtle "some
  sources are unavailable right now" hint (non-blocking) would explain thin
  results without alarming.
- [ ] **P3 — Impressions/fatigue are local-only.** `getImpressions()` reads
  localStorage; fatigue doesn't follow you across devices. Move to
  Supabase if cross-device feed freshness matters.

## 6. Testing & CI

- [x] **P1 (partial) — CI safety net.** Done 2026-07-17.
  `.github/workflows/ci.yml` runs typecheck + lint + unit tests + build on
  every push/PR — the deterministic checks that would have caught the
  regressions we hit. **Remaining:** port the Playwright flows from the
  scratchpad into a committed `e2e/` suite and add a browser job (needs
  `@playwright/test` + `npx playwright install chromium` in CI).
- [x] **P2 — Data-layer tests (buzz providers).** Done 2026-07-17.
  `tests/data/buzz-providers.test.ts` fetch-mocks Listen Notes, xyzrank,
  小宇宙 (incl. refresh-first), and Reddit: happy-path parse + null-on-
  failure. Catalog server mappers still uncovered — follow-up.
- [ ] **P3 — Golden recommendation fixtures.** Snapshot the ranked output
  for a fixed engagement + candidate set so weight/scoring changes show a
  visible, reviewable diff.

## 7. Infrastructure & ops

- [x] **P2 — Check Supabase security advisors.** Ran 2026-07-13. All user
  tables (`saved_shows`, `engagement`, `prefs`, `saved_episodes`) have
  correct owner-scoped RLS. Follow-up below.
- [ ] **P3 — Tighten `shows` catalog-cache writes.** Advisors flag the
  `shows` INSERT/UPDATE policies as `with check (true)` — intentional (any
  signed-in user upserts catalog metadata), but it means a user could
  overwrite a cached show's title/art. If abuse ever matters, move catalog
  writes server-side (service role) and drop the authenticated write
  policies. (Leaked-password advisor is moot — auth is magic-link only.)
- [ ] **P3 — Lightweight, privacy-respecting analytics.** We have no
  visibility into whether discovery is *working* (saves per session, "not
  for me" rate, preview→open funnel). A minimal first-party events table
  would let us tune recs with data instead of guesses.
- [ ] **P3 — Cost/quotas dashboard.** As free-tier usage grows (Supabase
  rows, Listen Notes calls, Vercel bandwidth from audio not being
  proxied), a simple monthly check keeps us honest about the `$0` promise.

---

## 8. Deferred (v2+ — consciously out of scope for now)

From the PRD, still parked: in-app full audio player, transcription / AI
summaries, Taste Map visualization, weekly digests, OPML import, social
sharing, snapshot capture, native apps. See GitHub issues #8–#15.

---

## Changelog of shipped refinements

- 2026-07-17 — Live signal audit (see §2): **credentials confirmed valid**
  — Listen Notes key and 小宇宙 refresh token both return 200 against their
  live APIs (earlier 401s were a `[SENSITIVE]`-masking test artifact, now
  corrected). 小宇宙 refresh path verified end to end. Env vars set in
  Vercel Production; Supabase migration applied + advisors clean.
- 2026-07-13 — Preview clips now robust to CDNs without HTTP Range: the
  30s window anchors to actual playback start, so no-Range feeds play a
  clean 0:00 clip ("from the start") and Range feeds keep the random
  offset. Fixed a pre-seek anchor race found during verification.
- 2026-07-13 — Applied the `saved_episodes` migration and audited Supabase
  security advisors (RLS clean on all user tables).
- 2026-07-13 — Fixed first-run Home crash (unguarded `.length`) and
  hardened `/api/catalog/*` client parsers to coerce malformed bodies.
- 2026-07-13 — Trending/mainstream topics now lead the pickers; personal
  niche seeds hidden from chips but kept in the engine.
