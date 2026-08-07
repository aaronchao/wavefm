# CLAUDE CODE — SYSTEM INSTRUCTIONS: Wavr (Web v1)

> Feed this file to Claude Code as the project's `CLAUDE.md`.
> Modular by design. **Build one module at a time** (Section 3); don't load the whole app into context at once.

---

## 0. ROLE & HARD RULES

You are building **Wavr**: a free, browser-based, cross-device **podcast discovery app**. The ONE must-have is a great **recommendation + exploration** experience. Everything else is deferred.

**Non-negotiable rules:**
- `WEB_ONLY` — a responsive web app. No React Native, no native builds, no app stores.
- `FREE` — must build + host for $0: Vercel Hobby + Supabase free tier + free podcast APIs. Never introduce a paid key or paid service.
- `RECS_FIRST` — the recommendation engine + exploration UI is the core. Don't build deferred features (Section 11) in v1.
- `SYNC_VIA_SUPABASE` — user data (saved shows, engagement, prefs) lives in Supabase and syncs across devices; magic-link auth.
- `NO_HARD_DEPS_ON_EXTERNAL_APIS` — catalog/ratings failures = silent skip, never a blocking error.
- `PROXY_EXTERNAL_CALLS` — all third-party fetches (iTunes, Podcast Index, Douban, Xiaoyuzhou) go through the app's own `/api/*` routes (fixes CORS, hides keys, enables caching). The browser never calls them directly.
- `ONE_CLICK` — save / like / open / not-for-me are each a single click.
- `PURE_CORE` — recommendation logic in `/src/core` has no React/Next imports; fully unit-tested and deterministic.
- `NO_CODE_IN_TERMINAL` — never display code blocks/diffs in chat responses or terminal output (no `cat`/`sed -n` dumps of file contents, no pasted snippets). Use Read/Edit/Write tools to make changes silently; report what changed in prose only.
- Work **module by module** (Section 3). Finish + typecheck a module before the next.

---

## 0b. CHAT OUTPUT (how to talk to Aaron)

- **Never display code or file contents in chat.** Keep the conversation
  clean and decluttered. This covers all of: red/green diff blocks written
  into a reply; the `Added N lines, removed N lines` previews the Edit tool
  renders; and the `Wrote N lines to <path>` previews the Write tool renders.
- Create and edit files with shell heredocs (`cat > path <<'EOF'`) or
  python/perl instead — those render nothing. Reserve Edit/Write for when
  exact-match safety genuinely matters, and say why.
- Report what changed in prose, or cite `file_path:line_number`.
- Be concise and token-efficient: no padding, no restating what's settled.

---

## 1. TECH STACK (fixed)

| Concern | Choice | Note |
|---|---|---|
| Framework | **Next.js (App Router) + React + TypeScript (strict)** | Pages + API routes (the proxy) in one deployable. |
| Hosting | **Vercel (Hobby, free)** | Auto-deploy from git. |
| DB + Auth | **Supabase (free tier)** | Postgres + magic-link auth + Row Level Security. Source of truth for user data. |
| Server data access | **Next.js Route Handlers** (`/app/api/*`) | Proxy + cache for catalog & ratings; hides keys. |
| Async/cache (client) | **TanStack Query** | Catalog/ratings fetches, long staleTime. |
| UI state | **Zustand** (small) or React context | Ephemeral UI only. |
| Styling | **Tailwind CSS** | Fast, consistent tokens. |
| Motion | **Framer Motion** | Spring physics, playful micro-interactions. |
| Catalog | **iTunes Search API** (free, no key) + **Podcast Index** (free key, server-side) | Via `/api/catalog/*`. |
| RSS parse | `fast-xml-parser` | Enrich metadata / add-by-URL (server-side). |

> If you believe a better free option exists at build time, propose it in one line before switching — don't silently deviate. Never swap in anything paid.

---

## 2. FILE STRUCTURE (create this skeleton first)

```
/app                          # Next.js App Router
  layout.tsx, page.tsx        # Home / "What next?"
  topics/page.tsx
  search/page.tsx
  show/[id]/page.tsx
  settings/page.tsx
  /api                        # server-only proxy + cache (hides keys, fixes CORS)
    /catalog/search/route.ts
    /catalog/show/route.ts
    /ratings/route.ts
/src
  /core                       # PURE logic, no React/Next imports — unit-tested
    /recommend                # vectorize, taste, score, cluster, why, diversify
    /taste                    # cluster math, interest model
  /data
    /supabase                 # client, auth, schema types
    /repos                    # showRepo, engagementRepo, prefsRepo, ratingsRepo
    /catalog                  # typed clients for /api/catalog/* + RSS enrich
    /ratings                  # RatingsProvider + Douban/Xiaoyuzhou adapters (server)
  /state                      # zustand + query client
  /ui                         # design system: tokens, primitives, motion
  /features                   # screen compositions (wire core + data + ui)
/tests                        # mirrors /src/core
```

**Rule:** `/src/core` must have **zero** React/Next imports so it stays pure and testable.

---

## 3. BUILD ORDER (modules — one PR each, typecheck between)

**M0 — Scaffold + deploy.** Next.js + TS strict + Tailwind + lint + the skeleton (Section 2). Supabase client wired (env vars). Deploy to Vercel so there's a live URL. Acceptance: hello-world Home renders locally AND on the Vercel URL.

**M1 — Catalog layer.** `/api/catalog/search` + `/api/catalog/show` proxying iTunes (primary) → Podcast Index (secondary). Typed client in `/src/data/catalog`. Search screen: query → results → add/save a show. Acceptance: searching returns real shows; CORS handled via the proxy; a show can be saved.

**M2 — Data model + auth + sync.** Supabase schema (Section 5) + RLS; magic-link login; repos for saved shows, engagement, prefs. Acceptance: sign in on two browsers → saved shows appear in both; signed-out app still browses/searches (read-only).

**M3 — Design system.** Tailwind tokens (cover-art color, radii, spring configs), primitives (Card, CoverTile, Chip, RatingBadge), Framer Motion wrappers. Acceptance: a demo page renders primitives with playful motion.

**M4 — Recommendation engine (THE must-have).** Pure `/src/core/recommend`: `vectorizeShow`, `tasteVector`, `scoreCandidate`, `cluster`, `diversify`, seed clusters, "why" strings. Fully unit-tested + deterministic. Acceptance: given fixture engagement + candidates, tests assert stable scores, clusters, and "why" copy.

**M5 — Explore UI (Home + Topics).** Home consumes the engine: clustered feed with "why" chips; onboarding interest picker on first run; Topics screen to browse/tune clusters; one-click save/like/not-for-me feeding engagement. Acceptance: first run → pick interests → useful clustered feed with reasons; actions update recs.

**M6 — Show detail + deep-link OUT + ratings.** Show page: metadata, deep-link chips (Apple from iTunes; Spotify/YouTube Music/Xiaoyuzhou stored-URL-or-search, dim if none). `/api/ratings` with Douban/Xiaoyuzhou fallback ladder (Section 7) + 7-day Supabase cache; badges on cards/detail. Acceptance: chips open correct web URLs in a new tab; rating badge shows when reachable, silently absent when blocked; never blocks render.

**M7 — Polish.** Empty states, responsive/mobile-web pass, motion feedback, settings (interests, ratings sources on/off, account, sign out). Acceptance: full discover loop feels tactile on phone + desktop; all toggles work.

---

## 4. STATE MANAGEMENT (rules)
- **Supabase** = source of truth for user data (saved shows, engagement, prefs). Read/write via `/src/data/repos`.
- **TanStack Query** = all async/cacheable fetches (catalog search, show detail, ratings). Long `staleTime` (ratings 7d, catalog hours).
- **Zustand/context** = ephemeral UI only (active filter, sheet open). Never a long-term copy of DB rows.
- **`/core` is pure** — receives plain data, returns plain data; features call core, core imports nothing from React/Next/stores.

---

## 5. DATA MODEL (Supabase / Postgres — define, don't over-build)

```
shows(id, itunesId?, feedUrl, title, author, description, categories[],
      language, coverUrl, clusterTags[], platformLinks jsonb)   -- catalog cache
saved_shows(userId, showId, createdAt)
engagement(id, userId, showId, type, weight, createdAt)          -- save/like/open/block/impression
prefs(userId, interests[], ratingSources jsonb, ...)
ratings_cache(showId, source, rating, fetchedAt)                 -- TTL 7d
```
- RLS: user rows keyed by `auth.uid()`; `shows`/`ratings_cache` are shared read caches.
- `type` weights (engagement): save=+3, like=+2, open=+1, block=−3, impression=−0.5.
- `platformLinks` = `{apple?, spotify?, youtubeMusic?, xiaoyuzhou?}` (URLs, may be partial).

---

## 6. CATALOG & DEEP-LINK OUT
1. **Search/detail** always via `/api/catalog/*`: client → route handler → iTunes (primary) → Podcast Index (secondary). Cache hot results in `shows`.
2. **Metadata** from iTunes gives title, art, `feedUrl`, Apple Podcasts URL. Optionally parse RSS server-side to enrich categories/description for better vectors.
3. **Deep-link OUT (web URLs, new tab):**
   - Apple Podcasts: use iTunes result URL.
   - Spotify / YouTube Music / Xiaoyuzhou: stored URL if known, else a **platform search URL** for the show name; **dim the chip** if unavailable.
4. Never assume a show exists on every platform — missing = dimmed chip, never an error.

---

## 7. EXTERNAL RATINGS (fallback strategy — APIs NOT assumed open)
Implement `/src/data/ratings/RatingsProvider` (called server-side from `/api/ratings`); each provider returns `rating | null`, NEVER throws to the UI.

**Fallback ladder (each provider):**
`official API → unofficial endpoint → public web-page parse → return null (skip)`
- **DoubanProvider / XiaoyuzhouProvider** implement independently.
- Cache in `ratings_cache` (TTL 7d); serve cache first, refresh lazily.
- Fetch lazily on card view; never block render; badge resolves or disappears.
- Good-citizen: low volume, respect rate limits/robots, cache aggressively; scraping selectors behind small adapters.
- All rungs fail → no badge. Recommender treats missing rating as neutral.

---

## 8. RECOMMENDATION ENGINE (pure spec — the core deliverable)
Implement in `/src/core/recommend` (no React/Next imports; fully unit-tested):
1. `vectorizeShow(show)` → sparse tag/keyword weights (TF-IDF over title + description + categories + `clusterTags`).
2. `tasteVector(engagements, shows)` → weighted sum using engagement weights (Section 5) + onboarding interest picks.
3. `scoreCandidate(taste, show, rating?)` = `cosine(taste, show) + λ·normRating + freshnessBonus − fatiguePenalty`.
4. `cluster(candidates)` → topic groups + a human "why" per group ("More psychological case studies", "Because you saved 周小辣", "Highly rated on Douban").
5. `diversify(clusters, caps)` → cap per-cluster so the feed doesn't collapse.
6. **Seed clusters** (cold-start): *Asian gay podcasts, gay travel stories, storytelling, psychological case studies, book discussions.*
7. Deterministic + local — **no per-view API cost**. (Optional LLM re-rank is explicitly OUT of v1.)

---

## 9. DEFINITION OF DONE (per module)
- TypeScript strict passes; lint clean.
- `/core` changes have unit tests (recommend, clustering, ratings ladder).
- Feature degrades gracefully with a blocked API / offline (defined skip state).
- No new paid dependency; all external calls go through `/api/*`.
- One-click invariant preserved for save/like/open/not-for-me.

---

## 10. WHAT NOT TO DO
- Don't add React Native, native code, or anything platform-specific — this is a web app.
- Don't introduce a paid API, paid host, or required secret the free tiers can't cover.
- Don't call external APIs from the browser — always proxy through `/api/*`.
- Don't build deferred features (Section 11) in v1.
- Don't let a ratings/catalog/network failure surface as a blocking error.
- Don't put business logic in `/app` routes or stores — it lives in `/src/core`.
- Don't load multiple modules' context at once; follow M0→M7.

---

## 11. DEFERRED (NOT v1 — do not build yet)
Snapshot capture, in-app audio player, transcription/AI summaries, Taste Map visualization, weekly digests, OPML import, social sharing, native iOS/Android apps.
