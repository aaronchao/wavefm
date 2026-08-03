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

Last updated: 2026-08-03.

---

## Current top priorities — ranked by UX impact (2026-08-03)

Re-ranked against the product's core objective: help users **discover niche
content matching their taste via human discussion/recommendation** (needs
more EN *and* CN discussion sources), **easily collect and organise** what
they find, and **start listening in one click on whatever app they actually
use** — the recurring pain being platforms (YouTube Music above all) that
don't natively carry a show, forcing a manual RSS add. Each item below
expands into its home section (§ links); this list is the priority order.

1. **[organise] Inbox/Queue triage for the Library**, Castro-style. Today
   every Discovery save lands in one flat "Listen Later" list — the direct
   cause of "unmanageable as it grows." Split it: new saves land in an
   untouched **Inbox**; a one-gesture triage ("top of queue" / "bottom of
   queue" / archive) moves each into a small, deliberately-ordered
   **Queue**. Volume is allowed to pile up in the Inbox precisely *because*
   nothing there has been committed to yet — the Queue stays manageable
   because everything in it was a decision. This is the actual fix for
   "growing fast," more so than resequencing a flat pile. → §3.
2. **[one-click] Personal "Listen Later" RSS feed, synced to any podcast
   app.** Generate a private per-user feed (`/api/feed/listen-later/<token>`)
   from `saved_episodes` — real `<enclosure>` URLs already on hand (no
   rehosting), items ordered by a new `queue_rank` (see #3) via synthetic
   `pubDate` spacing. One URL, added once via each app's own "Add by URL"
   (confirmed working in Apple Podcasts, Overcast, Pocket Casts, AntennaPod,
   Castro, Downcast — standard on serious podcast clients) — from then on
   the user listens straight from their player and only opens WaveFM to
   discover more. Direct prior art: Listen Notes ships exactly this
   ("Listen Later" custom-playlist RSS). **Honest limits:** Spotify and
   YouTube Music have no listener-facing "add arbitrary RSS" at all — this
   doesn't reach them, matching the existing `links.ts` caveat; and any
   player picks up changes on its own poll schedule (often hourly+), not
   instantly. → §3.
3. **[organise] Resequence saved episodes.** `saved_episodes` currently has
   no ordering field at all (`status`/`position_sec` are playback state,
   not queue position). Add `queue_rank` (float, fractional-rank drag
   reorder — moving an item averages its new neighbors' ranks, so a
   reorder is one row update, never a full-list reindex — same pattern as
   Trello/Notion). Drives both the in-app drag-to-reorder UI and the
   synced feed's item order from #2 — one field, two features. → §3.
4. **[one-click] Remembered default player.** `platformLinks()` always
   renders all 5 icons — the user re-scans and re-clicks every single time.
   Add a `preferred_player` to `prefs`, and make the primary card/detail
   action one big "▶ Listen" button that opens that player's link directly
   (deep link if available, else next-best, else search); demote the icon
   row to a secondary "more options" affordance. The in-app complement to
   #2 — this is for opening one episode right now, #2 is for never coming
   back to WaveFM to fetch the next one. → §3.
5. **[one-click] Resolve real Spotify show URLs.** Confirmed in code: the
   `spotify` field in `PlatformLinks` is declared but **never populated** —
   every Spotify icon is a title-search, same class of friction as the
   YouTube Music complaint. Spotify's Web API `Search` endpoint works with
   app-only Client-Credentials auth (free, no user login), so we can store
   the real show page the same way `pca.st` already does for Pocket Casts.
   → §2/§6.
6. **[one-click] Fix the YouTube Music dead-end specifically.** YT Music has
   no add-by-RSS and no reliable show-search resolution — confirmed the
   named pain point, and structurally out of reach of #2 above. Two
   mitigations: (a) reuse the YouTube Data API key already wired for buzz
   to find the show's real YouTube channel/uploads and link straight to
   actual audio/video instead of a search that often comes up empty; (b)
   collapse "copy RSS" + "open YouTube Music" into one combined tap instead
   of two separate icons. → §2/§6.
7. **[discover] Ingest Listen Notes' "related podcasts" edges.** Listen
   Notes is currently used only for a popularity number (`listenScore`).
   Its actual `recommended_podcasts`/related-shows data is real
   listener-behavior similarity — a qualitatively better signal than mention
   counts — and it's on the same free-tier key already in use. → §1/§2.
8. **[discover-CN] Mine 知乎 (Zhihu) recommendation threads.** The CN signal
   set (Douban, Xiaoyuzhou, PTT, LIHKG, Dcard) is all ratings/forum-chatter —
   none of it is curated "please recommend a podcast" discussion the way
   Reddit is for English. Zhihu's recommendation-thread genre is the closest
   CN equivalent and is the single biggest gap in niche-matching data. Same
   RSSHub harvest shape as the existing Douban pipeline. → §2, `community-mining.md`.
9. **[discover-EN] Add Podchaser.** Free-tier API with critic reviews and
   user-curated genre lists ("best philosophy podcasts") — actual curatorial
   text, not just counts. Strengthens niche-cluster "why" copy for English
   shows. → §2.
10. **[discover-CN] Add Bilibili discussion signal.** Official public search
    API, no key, same shape as `youtube.ts` (near-zero new code). Covers a
    large volume of CN audio/video-podcast content and comment discussion
    that lives on Bilibili rather than 小宇宙. → §2.
11. **[organise] Auto-organise the Library into taste clusters.** Beyond
    manual tags, group saved shows using the recommendation engine's own
    cluster/"why" (an auto shelf like "Psychological case studies") so the
    library self-organises as it grows instead of degrading into one flat
    pile once it's easier to save things (per #4–6). → §1/§3.
12. **[organise] Auto-track listen progress from the preview player.**
    `saved_episodes.status`/`position_sec` exist but only the manual "Done?"
    toggle writes them. Matters more once listening is frictionless — an
    unused progress field means a bigger library can't show what's actually
    in progress. → §3.
13. **[organise] Real "new episodes" inbox** — and note this should probably
    *merge into the same Inbox from #1* rather than being a separate
    mechanism: a new episode of an already-saved show and a freshly-saved
    Discovery episode are the same kind of "here's something new, decide
    what to do with it" event, so one triage surface should handle both
    instead of shipping two half-solutions. Replaces the best-effort
    20-show badge. → §3.
14. **[protect discovery] Source health-check dashboard.** Douban,
    Xiaoyuzhou, PTT, LIHKG, Dcard, Apple-reviews are all scrapers; adding
    Zhihu/Bilibili/Podchaser (#8–10) grows that fragile surface further. A
    weekly "did every rung return a number" check protects the investment
    above from silently degrading unnoticed. → §2.
15. **[protect discovery] Confirm/unblock Reddit on Vercel's IPs.**
    Maintenance on an *existing* pillar-1 source, not a new capability —
    ranked last, but a real risk: if it's silently 403ing in prod, English
    discussion mining is already thinner than it looks. → §2.

### Inspiration references

Not podcast-specific, and hedged honestly on "award-winning" — I only kept
apps with a confirmed award or a very strong, verifiable design reputation
rather than guessing:

- **Things 3** (multiple confirmed Apple Design Awards) — the best reference
  for #1/#3 above: bucketed lists (Today / Upcoming / Anytime / Someday),
  trivially-easy drag reorder, keyboard-first quick capture. Closest
  non-podcast analogue to an Inbox/Queue split.
- **Spotify Discover Weekly** (2016 Webby Award, Best Streaming Audio) —
  the reference for the discovery pillar: blends collaborative filtering +
  content-based (text/NLP) + audio models, i.e. multiple heterogeneous
  signals combined into one ranked list — structurally the same idea as
  `scoreCandidate`'s cosine + rating + buzz blend, just at Spotify's scale.
  Worth studying the weekly-digest *framing* (a bounded, dated batch you're
  meant to work through) as an alternative to an endless feed.
- **Flighty** (Apple Design Award winner) — not content-related at all
  (flight tracking), but the reference for making a personal *data*
  collection feel crafted and alive rather than a bare list — relevant to
  how the Queue/Library should feel once it's not just a plain table.
  <br>Confirmed only by press coverage, not formally verified against an
  awards list, but consistently cited as best-in-class:
- **Raindrop.io** — collect/tag/organise-anything-from-the-web reference;
  closest analogue to "Library" as a general collection tool rather than a
  podcast-specific queue.
- **Castro**, **Letterboxd**, **The StoryGraph** — carried over from the
  earlier discussion (Inbox/Queue triage; taste-driven discovery + curated
  lists; mood/pace-vector recommendations) — still relevant, not re-argued
  here.

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
- [x] **P3 — Custom interests.** Done 2026-07-17. Settings now has a
  free-text "Add an interest" input (any term becomes a seed) and uses
  `defaultTopics()` for consistency (previously it still showed the hidden
  personal seeds — bug fixed). Still open: a one-tap "re-run onboarding"
  from Settings.
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
- [x] **P2 — Apple Podcasts ratings rung.** Done 2026-08-02.
  `ratings/apple.ts` averages the free public customer-reviews JSON feed's
  recent star ratings (1–5 → 0–10), walking a US → TW → CN → HK storefront
  ladder so both English and Chinese shows resolve where they're actually
  reviewed. Needs the numeric iTunes id; non-iTunes shows skip cleanly.
  Added as a third rung alongside Douban/Xiaoyuzhou in `provider.ts`, wired
  into `prefs.rating_sources` and `RatingsCacheRow`.
- [x] **P3 — Pocket Casts trending signal.** Done 2026-08-02.
  `buzz/pocketcasts.ts` reads Pocket Casts' public Discover
  popular/trending lists (no key) and maps entries to iTunes ids — one
  cached fetch (12h) serves the whole request pool. Feeds `popularityParts`
  in `recommend/buzz.ts` and a "Trending on Pocket Casts" why-string;
  wired into both `top-picks` and `charts/global` routes.
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
- [ ] **P1 — Inbox/Queue split for the Library.** Castro-style triage:
  Discovery saves (and new episodes of saved shows — see the merged item
  below) land in an untouched **Inbox**; one gesture ("top of queue" /
  "bottom of queue" / archive) commits each into a small, ordered **Queue**.
  Schema: `saved_episodes` gets a `bucket` column
  (`inbox | queue | archived`, default `inbox`) alongside the new
  `queue_rank` below. This is the actual fix for "unmanageable as it grows"
  — see the ranked-priorities note above for the full rationale.
- [ ] **P1 — Resequence saved episodes.** No ordering field exists today
  (`status`/`position_sec` are playback state, not queue position). Add
  `saved_episodes.queue_rank` (float8, nullable — only Queue items are
  ranked). Reordering = update one row's rank to the average of its new
  neighbors (fractional-rank pattern, same as Trello/Notion) — never a
  full-list reindex. Drag-and-drop in the Library UI; ties directly into
  the feed-sync item below.
- [ ] **P1 — Personal "Listen Later" RSS feed, synced to any podcast app.**
  New route `app/api/feed/listen-later/[token]/route.ts`: build an RSS
  document from the signed-in user's Queue, one `<item>` per saved episode
  with its real `audio_url` as the `<enclosure>` (no rehosting — same
  legal shape as the existing OPML export, just dynamic), ordered by
  `queue_rank` via synthetic descending `pubDate` spacing so
  newest-episode-first players show it in Queue order. `token` is an
  opaque per-user value (new `prefs.feed_token`, regenerable from Settings
  if it ever leaks) — no auth header needed since the URL itself is the
  credential, matching how every "private podcast feed" tool works.
  Confirmed working via manual "Add by URL" in Apple Podcasts, Overcast,
  Pocket Casts, AntennaPod, Castro, Downcast. Direct prior art: Listen
  Notes ships the identical mechanic as its "Listen Later" feature.
  **Won't reach Spotify or YouTube Music** — neither supports listener-
  added arbitrary RSS at all (matches the existing `links.ts` caveat) — and
  any player only picks up changes on its own poll cadence, not instantly;
  say so in the UI rather than promising live sync.
- [ ] **P2 — Auto-track listen progress from previews.** `saved_episodes`
  has `status` + `position_sec`, but only the manual "Done?" toggle writes
  them. Wire the preview player to mark an episode `in_progress` and record
  `position_sec` when the user plays it, so "resume" reflects reality.
- [ ] **P2 — External player progress sync.** Apple/Spotify/YouTube expose
  no progress API. Two real paths: (a) pull *played episodes* from 小宇宙
  with the user's token to reconcile finished/queued state; (b) support
  the open **gpodder.net** sync standard for players like AntennaPod.
  Both are meaningful features — scope separately.
- [ ] **P2 — "New episode" badge is best-effort → merge into the Inbox
  above.** It compares each saved show's latest `lastEpisodeAt` (capped at
  20 shows, RSS-enriched) against `savedAt` — no unread count, no
  per-episode list. Rather than building a separate "new episodes inbox,"
  route new episodes of saved shows into the *same* Inbox bucket as fresh
  Discovery saves — both are "here's something new, decide what to do with
  it," and one triage surface handling both avoids two half-solutions.

## 4. UX & accessibility

- [x] **P2 — Nested interactive elements.** Done 2026-07-17. New
  `PlayableCard` primitive: the play action is a transparent full-card
  `<button>` sibling (keyboard-focusable, aria-labelled), with secondary
  controls (Save/Details/+Later/Full) raised above it via `relative z-10`
  — no more interactive-in-interactive. Click-anywhere-to-play preserved.
  Applied to search, similar (shows+episodes), Top Picks, and Library
  rows. Verified: cover/title→play, Save→save-only, Details→navigate.
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

- [x] **P1 — CI safety net + committed E2E.** Done 2026-07-17.
  `.github/workflows/ci.yml` runs typecheck + lint + unit tests + build,
  plus a browser job running `e2e/smoke.spec.ts` (`@playwright/test`):
  live search, trending topics, custom-interest settings, queue→library,
  and degraded-Top-Picks. All `/api/*` stubbed at the browser boundary, so
  CI needs no external network. Locally: `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run e2e`.
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

- 2026-08-02 — Apple Podcasts ratings rung (US→TW→CN→HK storefront ladder,
  averaged recent review stars) and a Pocket Casts trending/popular signal
  (iTunes-id-mapped, feeds `popularityParts` + a "Trending on Pocket Casts"
  why-string). Both fully tested (34 new tests), typecheck + lint clean.
  Not yet committed as of this entry — see git status before assuming this
  shipped to `main`.
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
