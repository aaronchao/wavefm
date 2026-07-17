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
- [ ] **P1 — Supabase migration.** Run `supabase/migrations/002_collections.sql`
  in the SQL editor so the Library's listen-later queue syncs across
  devices instead of living in localStorage.
- [ ] **P2 — `wavr.is-a.dev` custom domain.** PR to `is-a-dev/register`
  with `domains/wavr.json` (CNAME → `cname.vercel-dns.com`) and
  `domains/_vercel.wavr.json` (TXT `vc-domain-verify=…`). Domain already
  added on the Vercel project side.
- [ ] **P2 — Rotate the pasted tokens.** The Listen Notes key and 小宇宙
  tokens were shared in chat; rotate them once everything's confirmed.

---

## 1. Recommendation quality

- [ ] **P2 — Fuzzy title matching for buzz sources.** `xyzrankBuzz`,
  `redditBuzz`, `listenNotesBuzz`, and `xiaoyuzhouBuzz` all match by exact
  lowercased title. Shows with punctuation/subtitle differences ("Show —
  The Podcast" vs "Show") miss their buzz. Add light normalization
  (strip punctuation, drop "podcast/radio/FM" suffixes) before matching.
- [ ] **P2 — Weight tuning is untested against real taste.** The
  `0.7 similarity / 0.3 popularity` (similar) and `0.55 / 0.45` (top
  picks) splits, plus buzz sub-weights, are reasoned guesses. Once there's
  real engagement data, revisit — ideally behind a small config object so
  it's one place to change.
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

- [ ] **P1 — Reddit blocks datacenter IPs.** `reddit.com/search.json`
  frequently 403s from Vercel's IPs, so the Reddit buzz signal may be
  quietly absent in production. Verify in prod; if blocked, either drop it
  or route through a lightweight allowed proxy / use the OAuth app API.
- [ ] **P1 — Verify the 小宇宙 app-API contract.** Endpoints, headers, and
  the refresh flow in `src/data/buzz/xiaoyuzhou.ts` are modeled on
  ultrazg/xyz and were **not** testable in the build sandbox. Confirm
  `/v1/search/create`, `/app_auth_tokens.refresh`, and the response shape
  against the live API; adjust field names (subscriptionCount/playCount/
  commentCount) to what's actually returned.
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

- [ ] **P1 — Preview clips need HTTP Range.** Random-offset clips rely on
  the podcast CDN honoring Range requests. CDNs that don't will play from
  0:00. Detect (probe `Accept-Ranges` / a short range) and, when absent,
  either pick offset 0 gracefully or show "preview from start".
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
- [ ] **P2 — Custom error boundary.** We fixed the first-run crash, but the
  fallback is Next's bare "This page couldn't load." Add a friendly
  per-route `error.tsx` with a retry, so any future runtime error degrades
  kindly.
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

- [ ] **P1 — Commit the E2E checks + run them in CI.** The Playwright flows
  used to verify each batch live in a scratchpad, not the repo. Port them
  to a committed `e2e/` suite (stubbed `/api/*`, Range-serving audio
  fixture) and run on PRs via a GitHub Actions workflow (see the
  `session-start-hook` skill for the web-session setup).
- [ ] **P2 — Data-layer tests.** Only `/src/core` is unit-tested. Add
  fetch-mocked tests for the catalog server mappers and buzz providers
  (shape parsing, null-on-failure, refresh-on-401) — the parts most likely
  to drift with upstream APIs.
- [ ] **P3 — Golden recommendation fixtures.** Snapshot the ranked output
  for a fixed engagement + candidate set so weight/scoring changes show a
  visible, reviewable diff.

## 7. Infrastructure & ops

- [ ] **P2 — Check Supabase security advisors.** Run the advisors and
  confirm RLS on all user tables (`saved_shows`, `engagement`, `prefs`,
  `saved_episodes`); `shows` / `ratings_cache` are intentionally shared
  read caches.
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

- 2026-07-13 — Fixed first-run Home crash (unguarded `.length`) and
  hardened `/api/catalog/*` client parsers to coerce malformed bodies.
- 2026-07-13 — Trending/mainstream topics now lead the pickers; personal
  niche seeds hidden from chips but kept in the engine.
