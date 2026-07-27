# Wavr — Route Design & Frontend Architecture (Phase 1)

> **Phase 1 = spec only.** No feature code, no DB/SQL. This document is the contract the
> build phase implements. Everything below is grounded in the existing wavefm codebase
> (Next.js 16 App Router, React 19, TS strict, Tailwind v4, TanStack Query v5,
> framer-motion 12, vitest, Playwright).

---

## 0. What Wavr is

A third top-level surface: a **stacked-card, one-decision-at-a-time swipe deck of
podcast episodes**. Each card is an episode + the community quote that earned it a
place in your deck. The top card **plays a 30s preview automatically** so the decision
is made by ear, not by cover art.

- **Swipe right → save the episode to Library** (`saved_episodes`, `queued`).
- **Swipe left → dismiss/skip** (negative engagement, excluded from future decks).

Wavr is the *committed* mode of discovery. Discover stays the browsing surface (rails,
charts, topics); Wavr is the focus mode. Positioned between them in the nav because
that's the funnel: browse → commit → own.

### Relationship to the existing `SurpriseDeck`

`src/features/discover/SurpriseDeck.tsx` is a **show**-level keep/skip modal launched
from Discover. Wavr is **episode**-level, is a route (deep-linkable, back-button
correct), has audio, has undo, and has a real physics model. The overlap is the drag
gesture only.

**Decision:** extract the shared physics/gesture into `src/features/wavr/` primitives
(`SwipeCard`, `useSwipeDeck`, `src/core/wavr/swipe.ts`) and refactor `SurpriseDeck` to
consume them in M-W5. Do **not** fork the gesture code. `SurpriseDeck` keeps its own
card body (show art + `Evidence`); only the motion layer is shared.

---

## 1. Navigation

### 1.1 Tab bar — `src/features/nav/TabBar.tsx`

Final tab set (3 tabs, `max-w-md`, unchanged bar chrome):

| # | Label | Href | Icon | Match |
|---|---|---|---|---|
| 1 | Discovery | `/` | `CompassIcon` | `p === "/"` |
| 2 | **Wavr** | `/wavr` | **`WavrIcon` (red)** | `p.startsWith("/wavr")` |
| 3 | Library | `/library` | `LibraryIcon` | `p.startsWith("/library")` |

**Search tab is removed** (per the working brief). `/search` remains a live route —
it is reachable from the Discover header search affordance and from empty states. No
route is deleted; only the tab is.

### 1.2 The red icon

The app's single accent (`--accent`, Signal Red `#ff3b30` / `#ff453a` dark) is already
red, so "make it red" cannot mean "use the accent" — that's what an *active* tab
already looks like. The distinctness has to come from **Wavr being the only tab that is
red when inactive**.

```
inactive tabs   → text-zinc-400
inactive Wavr   → text-accent/60          ← always red, muted
active   Wavr   → text-accent + glyph fill + 3px red dot under the label
active   others → text-accent (unchanged)
```

Additional treatment, spec'd exactly:

- `WavrIcon`: a 3-bar waveform inside a rounded square — `currentColor` strokes,
  `strokeLinecap="round"`, bar heights `[8, 14, 10]`, `strokeWidth 2.2` (heavier than
  the 1.8 of the other glyphs so it reads as the "loud" tab).
- Active-only: the middle bar animates height `14 → 18 → 14`, `springs.pop`, loop —
  **suppressed under `useReducedMotion()`**.
- Contrast: `#ff3b30` on `--background` `#fff` is 3.68:1 — passes AA for graphical
  objects/large text, fails for small body text. The **label text stays
  `text-zinc-400` when inactive**; only the glyph is red. Do not tint the 10px label.
- The `/60` inactive tint is applied via `text-accent/60`, not a second CSS var.

### 1.3 Route shell

```
app/wavr/page.tsx          server component; metadata + <WavrPage />
src/features/wavr/WavrPage.tsx   "use client"; the whole surface
```

`app/wavr/page.tsx` exports `metadata = { title: "Wavr — one swipe at a time" }` and
nothing else. All logic lives in `/src/features` (repo rule: no business logic in
`/app`).

**Layout interaction:** the root layout renders `<PreviewPlayer />` (fixed, `bottom-16`)
and `<TabBar />` (fixed, `bottom-0`). Wavr owns its own audio and must not double-play,
so `WavrPage` calls `player.dismiss()` on mount (see §5.4). The global bar is therefore
idle on `/wavr` and the deck can use the full `bottom-16 → header` band.

---

## 2. Screen layout

Mobile-first. Deck viewport = `100dvh − header(57px) − tabbar(64px)`, expressed as
`h-[calc(100dvh-121px)]` on the deck container, `max-w-sm mx-auto`.

```
┌──────────────────────────────────────┐
│ WAVR ·  12 LEFT              [tune]  │  MachineLabel row, 32px
│ ⟨ psychology ⟩ ⟨ 悬疑 ⟩ ⟨ storytelling ⟩ │  active lens chips, h-scroll, 36px
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ ┌────────────────────────────┐ │  │  card, aspect-[3/4], rounded-card
│  │ │        cover art 1:1       │ │  │  cover: full-bleed, scrim bottom 40%
│  │ │  ●─────────────  0:12/0:30 │ │  │  clip progress, on the scrim
│  │ └────────────────────────────┘ │  │
│  │  Episode title, up to 2 lines  │  │  text-lg font-bold leading-tight
│  │  Show title · 48 min           │  │  text-xs text-zinc-500
│  │  ┌──────────────────────────┐  │  │
│  │  │ “the one that made me    │  │  │  QuoteBlock — the recommendation
│  │  │  pull over and cry”      │  │  │  reason, 3-line clamp
│  │  │  — Reddit r/podcasts  ↗  │  │  │  source + link (new tab)
│  │  └──────────────────────────┘  │  │
│  │  ⟨psychology⟩ ⟨grief⟩          │  │  matched tags, PopIn stagger
│  └────────────────────────────────┘  │
│         (2 peek cards behind)        │
├──────────────────────────────────────┤
│      ✕          ▶/❚❚          ♥      │  56/64/56 px circles, 20px gaps
│    dismiss      play        save     │
└──────────────────────────────────────┘
```

Desktop (`sm:`): same deck, `max-w-md`, centred, with a persistent keyboard-hint row
(`← skip · → save · space play/pause · ⌫ undo`) replacing the swipe hint.

**Undo affordance:** after a decision, a 5s toast slides up above the button row —
`"Saved · Undo"` / `"Skipped · Undo"`. One level of undo only (§4.3).

---

## 3. Component tree & contracts

```
src/features/wavr/
  WavrPage.tsx        route shell: query, gating, empty/degraded states, undo toast
  WavrDeck.tsx        the stack: renders top + 2 peek, owns deck reducer
  SwipeCard.tsx       ONE draggable card + overlays; all motion lives here
  PeekCard.tsx        static behind-card, driven by the top card's motion value
  CardFace.tsx        presentational card body (art, titles, quote, tags, progress)
  QuoteBlock.tsx      the community quote + source attribution + ↗ link
  DeckControls.tsx    ✕ / ▶ / ♥ buttons (the a11y-canonical controls)
  LensBar.tsx         active interest-tag chips + "tune" → /settings#interests
  DeckEmpty.tsx       exhausted / no-tags / degraded states
  useDeckAudio.ts     A/B <audio> ping-pong, autoplay unlock, clip window
  useWavrFeed.ts      TanStack Query wrapper over /api/wavr/feed
  useSwipeDeck.ts     reducer + decision side-effects (save/skip/undo)
```

### 3.1 Props (exact)

```ts
// WavrDeck
{ cards: WavrCard[]; onDecide(card: WavrCard, d: Decision): void;
  onExhausted(): void; audio: DeckAudio }

// SwipeCard  — the only component that touches drag
{ card: WavrCard; onDecide(d: "save" | "skip"): void;
  onDragX(x: MotionValue<number>): void;   // handed up so PeekCard can react
  audio: DeckAudio; isTop: true }

// PeekCard
{ card: WavrCard; depth: 1 | 2; topX: MotionValue<number> }

// CardFace   — pure presentation, no motion, no audio; trivially snapshot-testable
{ card: WavrCard; progress: number; playState: PlayState }

// DeckControls
{ onSkip(): void; onSave(): void; onTogglePlay(): void; playState: PlayState;
  disabled: boolean }
```

### 3.2 Reuse from `/src/ui`

`CoverTile`, `Chip`, `Pressable`, `PopIn`, `springs`, `PRESS_SCALE` — all existing.
New tokens are **added to `src/ui/tokens.ts`**, not defined locally (§6.1).
`MachineLabel` is currently exported from `DiscoverPage.tsx`; move it to
`src/ui/primitives.tsx` and re-export so Wavr doesn't import from a sibling feature.

---

## 4. State architecture

Four tiers, matching the repo's existing rules (CLAUDE.md §4). **No new dependency** —
Zustand is not installed and is not needed; the repo's `useSyncExternalStore` pattern
(`src/state/player.ts`) covers the one cross-route case.

| Tier | Owner | Holds |
|---|---|---|
| Server cache | TanStack Query `["wavr","feed",tagKey,cursor]` | fetched `WavrCard[]`, `staleTime: 30 * 60_000`, `gcTime: 2h` |
| Deck state | `useReducer` inside `useSwipeDeck` | index, decisions, undo slot, exhausted |
| Audio state | `useDeckAudio` (refs + small `useState`) | playState, progress, unlocked |
| Durable | existing repos | `saveEpisode`, `recordEngagement`, `impressionsRepo` |

Deck state is **ephemeral and local** — it dies on unmount, which is correct: a new
visit is a new deck. Nothing about the deck goes into a global store.

### 4.1 Deck reducer

```ts
type Decision = "save" | "skip";

type DeckState = {
  index: number;
  decided: { card: WavrCard; decision: Decision }[];   // append-only, for undo + telemetry
  undoable: { card: WavrCard; decision: Decision; at: number } | null;
  flying: { id: string; dir: -1 | 1 } | null;          // card mid-exit
};

type DeckAction =
  | { t: "decide"; card: WavrCard; decision: Decision; dir: -1 | 1 }
  | { t: "flownOut" }        // exit animation finished → advance index
  | { t: "undo" }
  | { t: "expireUndo" }
  | { t: "reset"; };
```

**Advance timing:** `decide` sets `flying` and *does not* bump `index`. `index`
increments on `flownOut` (fired by framer-motion's `onAnimationComplete`), so the card
under it doesn't jump forward while the top card is still on screen. If the exit
animation never completes (tab backgrounded), a 600ms `setTimeout` guard dispatches
`flownOut` — the deck must never wedge.

### 4.2 Decision side-effects (fire-and-forget, never block the animation)

```ts
// save
void saveEpisode(toCatalogEpisode(card));            // savedEpisodesRepo (existing)
void recordEngagement(showOf(card), "save");         // weight +3
queryClient.invalidateQueries({ queryKey: ["saved"] });
queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });

// skip
void recordEngagement(showOf(card), "block");        // weight −3
void recordImpression(card.id);                      // impressionsRepo → feed exclusion
```

All repo calls already degrade to localStorage when signed out or Supabase is
unconfigured. **Signed-out Wavr is fully functional** — saves land locally and migrate
on sign-in via the existing `migrateLocalEpisodes()`. No auth gate.

### 4.3 Undo

One level, 5 seconds. `undo` reverses the reducer *and* the side-effects:
`removeEpisode(id)` + `recordEngagement(show, "impression")` to neutralise the block
(the engine treats a lone impression as −0.5, not −3; exact reversal is not worth a
delete API). Undo is unavailable once a second decision is made.

### 4.4 Feed paging

`useWavrFeed` requests 12 cards; when `index >= cards.length - 4` it fetches the next
page with `exclude=<decided ids>` and appends. Query key includes the tag lens so
changing interests starts a clean deck.

---

## 5. Audio

The hard requirement: **the top card buffers and plays a preview automatically**. Two
real constraints shape the design.

### 5.1 Autoplay policy (the constraint everyone forgets)

iOS Safari and Chrome block audible autoplay without a user gesture. Muted autoplay is
useless here — the whole point is hearing it.

**Unlock ritual:**

1. Deck mounts `audioUnlocked = false`. Top card shows a pulsing `▶ Tap to listen`
   badge over the cover art, and the ✕/♥ controls work normally.
2. **Any** user gesture on the deck (tap the badge, tap ▶, the first drag, an arrow
   key) calls `audio.play()` inside the gesture handler → unlocked for the session.
3. From then on, every card that becomes top **autoplays with no gesture**, because the
   `<audio>` element already has a user-activation grant.
4. `audioUnlocked` persists to `sessionStorage("wavr.audio.unlocked")` so an in-session
   route bounce doesn't re-prompt. Never `localStorage` — the grant is per page load.

If `play()` rejects at any later point, the card **silently falls to the quote-only
state** with a small `preview unavailable` line. Audio failure never blocks a swipe.

### 5.2 Prefetch — A/B ping-pong

Two `<audio>` elements, roles swapped on advance:

```
elA ── playing card[i]   (preload="auto", src set, seeked to clip origin)
elB ── buffering card[i+1] (preload="metadata" → "auto" once card[i] is playing)
```

On advance: pause+reset the outgoing element, swap the role refs, call `play()` on the
newly-primary element (already buffered → near-instant), then prime the freed element
with `card[i+2]`. Only ever **one audible element**; `elB.muted = true` until promoted.

Never prefetch more than one ahead — mobile data and the repo's "good citizen" rule.

### 5.3 Clip window

Reuse `src/core/preview.ts` verbatim: `CLIP_SECONDS`, `middleFraction(rand)`,
`clipStart(durationSec, rand)`. The card's `clipFraction` is computed **server-side and
frozen on the card** so the same card sounds the same across a re-render or an undo —
determinism over novelty.

The clip-window bookkeeping in `PreviewPlayer.tsx` (anchor origin on `seeked`, fallback
timer for non-seekable CDNs, clamp against unknown `duration`) is battle-tested and
**must be lifted into a shared hook** rather than reimplemented:

```
src/features/player/useClipWindow.ts   // extracted from PreviewPlayer, unchanged logic
  ↳ consumed by PreviewPlayer (refactor, no behaviour change)
  ↳ consumed by useDeckAudio
```

This is a prerequisite step in M-W2, not an optional cleanup.

### 5.4 Ownership

`WavrPage` calls `player.dismiss()` on mount and on unmount does nothing (the deck's
own elements are torn down by React). Rationale: one clip audible app-wide, and the
global bar's fixed `bottom-16` position would sit on top of the deck controls.

Add to `src/state/player.ts`: nothing. `dismiss()` already exists and suffices.

### 5.5 Progress UI

A 30s progress bar drawn on the cover scrim (`h-1`, `bg-white/30`, fill
`bg-accent`), plus `0:12 / 0:30`. When the clip finishes the card does **not**
auto-advance — the user still decides. The bar fills and a `↺ replay` control appears
in place of ▶.

---

## 6. Motion — mandated physics, no CSS transitions

**Library: framer-motion 12** (already a dependency; adding react-spring would be a
second animation runtime for zero gain). Every card transform is a spring on a
`MotionValue`. The only permitted CSS transition in this feature is `opacity` on the
undo toast and `color` on chips.

### 6.1 New tokens → `src/ui/tokens.ts`

```ts
export const springs = {
  ...existing,                                                   // settle, press, pop
  /** Card returning to centre after an uncommitted drag. */
  snap:  { type: "spring", stiffness: 520, damping: 34, mass: 0.8 },
  /** Card thrown off screen — velocity is injected at call time. */
  fling: { type: "spring", stiffness: 220, damping: 28, mass: 0.7, restDelta: 0.5 },
  /** Peek cards rising as the top card leaves. */
  rise:  { type: "spring", stiffness: 300, damping: 30, mass: 0.9 },
};

/** Swipe commit thresholds — mirrored exactly in core/wavr/swipe.ts. */
export const SWIPE = {
  /** Fraction of card width past which a release commits. */
  distanceRatio: 0.28,
  /** Absolute floor so tiny viewports still need a real gesture (px). */
  distanceMin: 88,
  /** Flick velocity that commits regardless of distance (px/s). */
  velocity: 550,
  /** Where the SAVE/SKIP stamps reach full opacity (px). */
  stampFull: 140,
  maxRotate: 16,
};
```

### 6.2 `SwipeCard` motion spec

```ts
const x        = useMotionValue(0);
const rotate   = useTransform(x, [-240, 240], [-SWIPE.maxRotate, SWIPE.maxRotate]);
const saveOp   = useTransform(x, [40, SWIPE.stampFull], [0, 1]);
const skipOp   = useTransform(x, [-SWIPE.stampFull, -40], [1, 0]);
const lift     = useTransform(x, [-240, 0, 240], [1.03, 1, 1.03]);   // subtle scale-up while dragging
```

- `<motion.div drag="x" dragConstraints={{left:0,right:0}} dragElastic={0.9}
   dragMomentum={false} style={{ x, rotate, scale: lift, originY: 1.15 }} />`
- `originY: 1.15` pivots rotation *below* the card — that's the difference between
  "rotating rectangle" and "card hinging in your hand". This is the single highest-value
  detail in the whole spec.
- `whileTap={{ cursor: "grabbing" }}`, `dragTransition` left to framer defaults.

**Release:**

```ts
onDragEnd(_, info) {
  const d = decideSwipe({ dx: info.offset.x, vx: info.velocity.x, width });
  if (d === "return") return;                     // framer springs back via springs.snap
  haptic("commit");
  animate(x, dir * width * 1.4, { ...springs.fling, velocity: info.velocity.x });
  onDecide(d);
}
```

Exit also animates `opacity → 0` over the last 40% and `rotate → dir * 22`.

### 6.3 Stack depth

Peek cards are driven by the **top card's** motion value, so the stack breathes as you
drag — the ADA-feel signature:

```ts
const away   = useTransform(topX, (v) => Math.min(Math.abs(v) / 160, 1));
// depth 1: scale 0.94 → 1.00 , y 14 → 0  , opacity 0.75 → 1
// depth 2: scale 0.88 → 0.94 , y 28 → 14 , opacity 0.45 → 0.75
```

Both use `springs.rise` on settle. Peek cards are `pointer-events-none`,
`aria-hidden="true"`, and render `CardFace` with `progress={0}` and cover art only
(title/quote hidden below depth 1 — the stack should read as *depth*, not as a wall of
text).

Render **exactly 3 cards**. Never the whole deck.

### 6.4 Stamps

`SAVE` (accent border + accent text, `rotate-12`, top-right) and `SKIP` (zinc-400,
`-rotate-12`, top-left), `font-brand uppercase border-2 rounded-pill`. Opacity is the
`saveOp`/`skipOp` motion value — **not** a state-driven re-render.

### 6.5 Reduced motion — `useReducedMotion()`

- `drag={false}`; the card is decided **only** by `DeckControls` and keyboard.
- No rotate, no lift, no stack breathing; peek cards render at their settled values.
- Advance = 120ms opacity crossfade (the one allowed `transition`).
- The waveform tab-icon animation is off.
- Everything remains fully operable. This is the accessible path, not a downgrade.

---

## 7. Haptics

`src/ui/haptics.ts` — a thin, dependency-free wrapper.

```ts
type Haptic = "tick" | "commit" | "reject" | "complete" | "undo";

const PATTERNS: Record<Haptic, number | number[]> = {
  tick:     8,            // threshold crossed mid-drag
  commit:   18,           // release past threshold — save or skip
  reject:   [6, 40, 6],   // action unavailable (e.g. undo expired)
  complete: [12, 60, 12], // deck exhausted
  undo:     10,
};

export function haptic(kind: Haptic): void;   // no-ops on unsupported platforms
```

| Trigger | Haptic | Notes |
|---|---|---|
| Drag first crosses commit threshold in a direction | `tick` | **Once per direction per drag**; a `crossedRef` resets on `onDragStart` and on re-entering the dead zone. Firing every frame is the classic bug. |
| `onDragEnd` with a committed decision | `commit` | Fires *before* the fling animation starts |
| Tap ✕ or ♥ | `commit` | Button path gets identical feedback to the gesture path |
| Undo tapped | `undo` | |
| Undo tapped after expiry | `reject` | |
| Last card decided | `complete` | |
| Audio unlock succeeds | — | none; the sound *is* the feedback |
| Snap-back (uncommitted release) | — | none; silence is the signal you didn't commit |

**Gating (all must pass):** `"vibrate" in navigator` · not `prefers-reduced-motion` ·
`prefs.haptics !== false`. Wrapped in try/catch — some browsers throw on
`vibrate()` outside user activation.

**Platform truth:** `navigator.vibrate` is Android/Chromium only. **iOS Safari has no
web haptics API** and there is no free, non-hacky workaround. On iOS the deck relies on
the spring physics + the stamp overlays as the tactile channel. Document this in the
settings copy ("Haptics — Android web only") rather than shipping a control that
silently does nothing.

---

## 8. Recommendation logic (frontend contract)

### 8.1 Hard constraint: no collaborative filtering

The engine matches **the user's own interest tags** against **NLP-parsed community
discussion text**. It is a content/text model, not a behavioural one.

**Forbidden — do not design, build, or leave a hook for:**

- any user × item matrix, or user-similarity / neighbourhood computation
- co-occurrence counted over *users* ("listeners who saved X also saved Y")
- embeddings, ALS/SVD factors, or clusters learned from cross-user behaviour
- any request or response field that carries another user's identity or behaviour

**Permitted signals only:**

1. `prefs.interests[]` — the user's declared tags (existing `prefsRepo`).
2. The user's **own** engagement history (`engagementRepo`), used solely to reweight
   *their own* tag vector and to exclude seen items. Never joined across users.
3. **Text** of public community discussion, parsed by the existing pure NLP pipeline in
   `src/core/mining/` (`normalize`, `scan`/gazetteer, `intent`, `sentiment`) into tags,
   a stance, and a citable quote.

The existing `rec_edges` table is admissible **only** through its text side: an edge's
`evidence[]` quote and the tags parsed out of it. The `score` / `author_count` columns
are **not** consumed by Wavr — `author_count` counts *forum posters*, and using it as a
ranking key would be co-mention popularity, i.e. CF by the back door. Wavr reads
`evidence` and re-derives its own tag match.

### 8.2 Pure core — `src/core/wavr/` (no React/Next imports, unit-tested)

```ts
// types.ts
export type TagWeights = Record<string, number>;   // L1-normalised, all ≥ 0

export type ParsedDiscussion = {
  quote: EdgeEvidence;        // { source, text, url? }  — reuse core/mining type
  tags: TagWeights;           // tags NLP-parsed from the quote + thread title
  sentiment: number;          // −1..1 from core/mining/sentiment
  intent: Intent;             // "recommendation" | "seed" | "comention"
};

export type WavrCandidate = {
  episodeId: string; showId: string;
  title: string; showTitle: string;
  coverUrl?: string; audioUrl?: string; durationSec?: number; appleUrl?: string;
  publishedAt?: string;
  discussions: ParsedDiscussion[];
};
```

```ts
// interest.ts
/** The user's tag vector. Their prefs + their own engagement. Nobody else's. */
export function interestProfile(
  interests: string[],
  engagements: { showId: string; type: EngagementType }[],
  showTags: Record<string, string[]>,
): TagWeights;

// match.ts
/** Tag-overlap score of one discussion against the profile. */
export function matchDiscussion(profile: TagWeights, d: ParsedDiscussion): number;
//   cosine(profile, d.tags)
//   × intentBoost   ("recommendation" 1.0 | "seed" 0.7 | "comention" 0.5)
//   × sentimentGate (max(0, 0.5 + d.sentiment / 2))

/** Best-matching discussion becomes the card's quote — the shown reason IS the score. */
export function scoreCandidate(profile: TagWeights, c: WavrCandidate):
  { score: number; quote: EdgeEvidence; matchedTags: string[] } | null;
//   null when no discussion clears MIN_MATCH (0.12) — the candidate is dropped.
//   A card with no honest reason to exist does not get shown.

// deck.ts
/** Order + diversify. Deterministic given the same inputs. */
export function buildDeck(
  cs: WavrCandidate[], profile: TagWeights, opts?: DeckOptions,
): WavrCard[];
//   sort by score desc
//   cap 2 episodes per show per deck
//   no 2 consecutive cards from the same show
//   cap 60% of the deck on any single dominant tag  (reuse core/recommend/diversify)
//   drop episodes with no audioUrl to positions ≥ 6 (audio-first, but not audio-only)

// swipe.ts   ← PURE physics decision, no React, no DOM
export function decideSwipe(
  i: { dx: number; vx: number; width: number },
): "save" | "skip" | "return";
```

`decideSwipe` living in `/core` is deliberate: the swipe thresholds are the feature's
most tunable numbers and the easiest to regress. They get a unit test table, not a
manual thumb-test.

### 8.3 API contract (route implemented in the build phase; **no DB code in Phase 1**)

```
GET /api/wavr/feed?tags=<csv>&limit=12&exclude=<csv of episodeIds>&cursor=<opaque>

200 → {
  cards: WavrCard[],
  cursor: string | null,
  degraded: boolean          // true when every upstream failed — never a thrown error
}
```

`WavrCard` (the wire + client type, `src/data/catalog/types.ts`):

```ts
export type WavrCard = {
  id: string;              // `${showId}:${episodeId}` — stable, dedupe key
  episodeId: string; showId: string;
  title: string; showTitle: string;
  coverUrl?: string; appleUrl?: string;
  audioUrl?: string; durationSec?: number;
  /** Frozen clip origin as a fraction of true duration — determinism (§5.3). */
  clipFraction: number;
  /** The community quote that earned this card its slot. */
  quote: EvidenceItem;
  /** Tags that matched the user's profile — rendered as chips. */
  matchedTags: string[];
  /** One-line human reason, built in core. Explainability is the product. */
  why: string;
  score: number;
};
```

Source ladder (server-side, each rung silently skipped on failure):
`rec_edges.evidence` → `/api/catalog/charts/discussed` → `/api/catalog/episodes-ranked`
for the matched shows. All rungs fail → `degraded: true`, and the UI shows the
`DeckEmpty` degraded state. Cache header `s-maxage=1800, stale-while-revalidate=86400`.

### 8.4 `why` copy (built in core, deterministic)

| Condition | String |
|---|---|
| ≥1 matched tag + quote | `Matches your interest in {tag} — {source} listeners keep bringing it up` |
| matched tags, generic quote | `{n} threads about {tag} point here` |
| single strong tag | `Because you follow {tag}` |
| cold start (no tags yet) | `A starting point — tell Wavr what you like to sharpen this` |

Never fabricate counts. If the number isn't in the data, the string doesn't claim one.

---

## 9. States

| State | Trigger | UI |
|---|---|---|
| **Cold start** | `prefs.interests.length === 0` | `DeckEmpty` variant: "Wavr needs three things you're into." Inline `InterestPicker` (reuse `src/features/explore/InterestPicker.tsx`) → writes via `setInterests` → deck builds. No dead-end. |
| **Loading** | query pending | 3 skeleton cards in the stack shape, `animate-pulse`, no spinner |
| **Ready** | cards present | the deck |
| **Audio locked** | `!audioUnlocked` | `▶ Tap to listen` badge pulsing on cover (§5.1) |
| **No audio for card** | `!card.audioUrl` or `play()` rejected | quote-only card, `preview unavailable` line, ▶ replaced by a dimmed Apple/Spotify link row (`platformLinks`) |
| **Exhausted** | index past end, no next page | "That's the deck. {n} saved." → `View Library` + `Back to Discover` + `Tune interests` |
| **Degraded** | `degraded: true`, 0 cards | "Wavr couldn't reach the discussion sources. Discover still works." → link to `/`. Never an error boundary. |
| **Offline** | fetch rejects | same as degraded, plus "You're offline" |

Per repo rule `NO_HARD_DEPS_ON_EXTERNAL_APIS`: nothing here throws to `app/error.tsx`.

---

## 10. Accessibility

The swipe is an **enhancement**; the buttons are the interface.

- `DeckControls` are real `<button>`s with `aria-label` `Skip this episode` /
  `Play preview` / `Save to library`. They are the canonical path — tab order reaches
  them before the card.
- Deck container: `role="group"` + `aria-roledescription="card deck"` +
  `aria-label="Recommended episodes"`.
- Card: `aria-roledescription="card"`; peek cards `aria-hidden="true"`.
- Live region (`aria-live="polite"`, visually hidden) announces on every advance:
  `"Card 3 of 12. {episode title}, from {show}. Reason: {why}."`
- Decision announcements: `"Saved to library. Undo available."` / `"Skipped."`
- Keyboard: `←` skip · `→` save · `Space` play/pause · `Backspace` undo · `Esc` → `/`.
  Bound on the deck container with `tabIndex={0}` and focus ring
  `focus-visible:outline-2 focus-visible:outline-accent`. Handlers guard against
  firing while focus is in a text input.
- Quote link opens in a new tab with `rel="noopener noreferrer"` and a visible `↗`.
- Cover art is decorative (`alt=""`) — the title carries the meaning, matching
  `CoverTile`'s existing contract.
- Touch targets ≥ 44px; the ♥/✕ circles are 56px.
- Audio is never the only channel: the quote and tags carry the reason in text.

---

## 11. Performance budget

- **3 DOM cards max** (top + 2 peek), regardless of deck length.
- **1 audio prefetch ahead.** `preload="metadata"` until promoted.
- Cover art: top card `loading="eager" fetchPriority="high"`; peeks `loading="eager"`;
  everything beyond depth 2 is not rendered so it costs nothing.
- Motion values only — a drag must cause **zero React re-renders**. `x`, `rotate`,
  stamp opacity, and peek transforms are all `MotionValue`s. `useState` inside
  `SwipeCard` during a drag is a bug.
- Progress state updates throttled to ~4Hz (`timeupdate` fires ~4×/s; don't add more).
- Feed page = 12 cards ≈ 6KB JSON.

---

## 12. Build order (post-approval)

| Step | Scope | Done when |
|---|---|---|
| **M-W0** | Tab bar: remove Search, add Wavr (red `WavrIcon`), `app/wavr/page.tsx` stub | `/wavr` renders, nav order correct, `tsc` + lint clean, e2e nav smoke passes |
| **M-W1** | `src/core/wavr/*` — types, `interestProfile`, `matchDiscussion`, `scoreCandidate`, `buildDeck`, `decideSwipe` | `tests/core/wavr/*.test.ts` green; fixture deck is byte-stable across runs |
| **M-W2** | Extract `useClipWindow` from `PreviewPlayer` (no behaviour change) + `useDeckAudio` A/B + unlock | `PreviewPlayer` still passes its existing tests; deck plays and prefetches |
| **M-W3** | `SwipeCard` / `PeekCard` / `CardFace` / `DeckControls` + motion tokens + haptics | Deck is fully operable by drag, button, and keyboard; reduced-motion path verified |
| **M-W4** | `/api/wavr/feed` + `useWavrFeed` + all §9 states + undo | Real cards; every degraded path renders, none throws |
| **M-W5** | Refactor `SurpriseDeck` onto the shared gesture; polish; settings haptics toggle | No duplicated drag code; `npx vitest run` + `npm run e2e` green |

Each step: `npx tsc --noEmit` → `npm run lint` → `npx vitest run` →
`PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e`.

## 13. Test plan

**Unit (`tests/core/wavr/`)** — pure, deterministic, no mocks:

- `swipe.test.ts` — table over `{dx, vx, width}`: below both thresholds → `return`;
  past `distanceRatio` → commit; slow long drag vs. fast short flick; the
  `distanceMin` floor on a 320px viewport; sign correctness both directions.
- `interest.test.ts` — profile is L1-normalised; a `block` lowers its tags; an empty
  history returns the prefs vector unchanged.
- `match.test.ts` — `intentBoost` ordering; negative sentiment gates a match to ~0;
  zero tag overlap → `null` from `scoreCandidate`.
- `deck.test.ts` — same input → identical order (run twice, deep-equal); per-show cap;
  no two consecutive same-show cards; dominant-tag cap.
- **CF guard:** `no-collab.test.ts` — asserts no export of `src/core/wavr/*` accepts a
  parameter carrying a second user's data, and greps the module source for
  `userId`/`neighbou?r`/`coOccur` to fail the build if CF creeps in. Cheap, and it
  makes the constraint enforceable rather than aspirational.

**Component** — `CardFace` renders quote + source + matched tags; renders the
no-audio variant without crashing.

**E2E (`e2e/smoke.spec.ts`, extended)** — nav shows Discovery/Wavr/Library and no
Search tab; `/wavr` renders a card; clicking ♥ advances and increments the Library
count; ✕ advances without saving; Undo restores; keyboard `→` saves.

---

## 14. Open assumptions (decided, not asked)

1. **Cards are episodes, not shows.** A 30s preview and a "why I cried" quote are
   episode-shaped. Shows are what Discover and Library already do.
2. **Search tab removed, `/search` route kept.** Three tabs let Wavr sit dead-centre;
   deleting a working route to remove a tab would be scope creep.
3. **Signed-out Wavr works.** Everything degrades to localStorage already. An auth wall
   on the flagship interaction would be self-defeating.
4. **Swipe-right saves the episode only** — not the show. Saving a show from one good
   episode is a bigger commitment than a swipe implies. The show still gets `+3`
   engagement, so the taste model learns from it.
5. **No auto-advance on clip end.** The user decides; the deck never decides for them.
6. **framer-motion, not react-spring.** Already a dependency, `MotionValue` + `drag`
   are exactly this problem, and a second animation runtime is dead weight.
