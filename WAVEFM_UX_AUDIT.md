# Wavr UI/UX Code Audit

Scope: implementation-level UI/UX issues in the current codebase — component structure, consistency, accessibility, animation coherence, responsiveness, design-system fragmentation. Not new product features. Ranked by impact.

---

## 1. The iOS-jiggle "phase offset" doesn't actually apply — every card jiggles in sync

**Files:** `src/features/library/EpisodeCard.tsx` (lines 25–31, 124–126), `app/globals.css` (lines 139–142)

**Problem:** `jiggleDelayMs(id)` computes a stable 0/70/140ms offset per card, but it's wired in as a Tailwind arbitrary-value class built from a template string:
`` `jiggle [animation-delay:${jiggleDelayMs(episode.episodeId)}ms]` ``.
Tailwind's JIT scanner matches whole class-name literals in source text — an interpolated value inside `[...]` can never be a match at build time, so this class is never generated. Separately, the CSS itself (`.jiggle { animation-delay: var(--jiggle-delay, 0s) }`) reads a custom property that nothing ever sets (no `style={{ "--jiggle-delay": ... }}` anywhere). Net effect: every card jiggles perfectly in phase — the opposite of the code's own comment ("start slightly out of phase... like real Springboard icons").

**Fix:** Set the CSS variable inline instead of relying on Tailwind to generate a dynamic class: `style={{ ...style, "--jiggle-delay": \`${jiggleDelayMs(episode.episodeId)}ms\` }}`, and drop the bracket-class from `className` entirely. No new library needed — just correct wiring of the mechanism already in `globals.css`.

---

## 2. "Liquid Glass" is copy-pasted five times instead of being one shared primitive

**Files:** `src/features/discover/ShowRowCompact.tsx` (the one place with a real `glass` prop), duplicated verbatim in `XyzrankBoard.tsx` (`XyzrankShowRow`/`XyzrankEpisodeRow`), `EpisodeCharts.tsx`, `RankedRecs.tsx` (`EpisodeColumnRow`) — plus two independently-invented translucency recipes in `PreviewPlayer.tsx` (bottom Play bar) and `TabBar.tsx` (a third, different opacity/blur combo).

**Problem:** The exact class string `border-white/30 bg-white/30 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-black/30` is hand-repeated in four row components that also each reimplement cover+play+title+stats+save-toggle markup structurally similar to `ShowRowCompact` itself. This reads as an unfinished rollout rather than a deliberate scoping choice — there's no single source of truth for "what glass is" in this codebase, so a future tweak (e.g. adjusting blur strength) requires editing 5+ call sites and hoping none are missed.

**Fix:** Extract a `.glass-panel` utility class in `globals.css` (or a `<GlassSurface>` wrapper in `src/ui/`), and have the duplicate row components consume it (or render `<ShowRowCompact glass />` directly where structurally possible) instead of inlining the recipe. Reconcile `PreviewPlayer`/`TabBar`'s separately-invented translucency with the same token once the scope expands past Discover.

---

## 3. Motion feels subtly inconsistent because spring tokens are bypassed

**Files:** `src/ui/tokens.ts` (the shared `springs` vocabulary), vs. hardcoded values in `src/features/wavr/DeckOverview.tsx` (`{ stiffness: 260, damping: 30, mass: 0.9 }`) and `src/features/player/PreviewPlayer.tsx` (`{ stiffness: 400, damping: 32 }`).

**Problem:** Both hardcoded springs are *close to but not* an existing named token (`springs.rise` is `300/30/0.9`; `springs.press` is `600/32`) — the kind of near-miss that suggests someone eyeballed "something that feels similar" rather than reusing the shared vocabulary the tokens file's own doc comment calls for. Small unintentional divergences like this are exactly what make cross-feature motion feel inconsistent even when no one can point at a specific broken animation.

**Fix:** Either point these two call sites at `springs.rise`/`springs.press` directly, or — if the feel is deliberately different — name the divergence (`springs.overview`, `springs.sheet`) inside `tokens.ts` so every spring value in the app lives in one file.

---

## 4. `text-zinc-400` on informational text fails contrast guidelines

**Files:** ~60 call sites, notably `EpisodeCard.tsx` (status/resume line), `XyzrankBoard.tsx` (stat row), `InlineTagInput.tsx` (placeholder).

**Problem:** `zinc-400` (`#a1a1aa`) against `--background: #ffffff` is ≈2.9:1 — below the 4.5:1 (normal text) and even the 3:1 (large text) WCAG AA thresholds — and it's used for content people actually need to read (episode status, resume position, play/comment counts), not purely decorative hairlines.

**Fix:** Bump these to `zinc-500`/`zinc-600` in light mode (≈4.6:1+, still visually light-touch), or introduce a theme-aware `--muted-foreground` variable in `globals.css` so contrast is enforced once centrally instead of ad hoc per call site.

---

## 5. The Wavr swipe-deck stage uses a fixed rem height with no small-viewport fallback

**Files:** `src/features/wavr/WavrDeck.tsx` (`h-[27rem]`), `WavrPage.tsx` (`h-[28rem]` skeleton), `discover/SurpriseDeck.tsx` (`h-[26rem]`), `DeckEmpty.tsx` (`h-[28rem]`).

**Problem:** 432px of stage plus the page's own top/bottom chrome padding plus `LensBar`/`DeckControls` can exceed the visible viewport on short phones (iPhone SE-class, ~560–600px usable height), forcing page scroll on a screen whose whole interaction model is full-surface swipe — scroll and swipe gestures then compete for the same pointer events.

**Fix:** Replace the fixed rem with a viewport-relative clamp, e.g. a Tailwind arbitrary value like `h-[min(27rem,60dvh)]`, so the stage shrinks gracefully on short viewports instead of overflowing.

---

### Runners-up (not in the top 5, worth a look later)
- `DeckOverview.tsx`'s fixed `h/w-[200px]` fan-covers may crowd on viewports under ~360px wide.
- `EpisodeCard.tsx`'s drag-grip icon is a 16px (`h-4 w-4`) touch target — under the ~44px minimum recommended tap-target size.
- `InlineTagInput.tsx`'s fixed `w-14` draft-tag input only works today because it's `shrink-0` inside a horizontally-scrolling row; fragile if reused in a non-scrolling context.
