# Session handoff — where we are

> Living snapshot. Update this at the end of each session (see
> `docs/CONTINUING-WORK.md` §5). For how to resume, read `CONTINUING-WORK.md`.

**Last updated:** 2026-07-30
**Branch:** `main` (everything committed + pushed; working tree clean)
**Latest commit:** `92316e6 feat(buzz): re-enable Listen Notes with just an API key`

---

## ⚠️ Action items for you (require the Vercel dashboard — I can't set env vars)

- **Xiaoyuzhou account ban:** the `buzz/xiaoyuzhou.ts` provider authenticates as a
  **personal 小宇宙 account** (env `XIAOYUZHOU_ACCESS_TOKEN` / `_REFRESH_TOKEN`) and
  hits the private app API per request — the likely cause of the ban. Code now
  bounds/caches it, but the real fix is to **remove those two env vars from Vercel**
  (or replace with a throwaway account's tokens). `xyzrank` still gives 小宇宙-derived
  buzz for free with no account.
- **Re-enable Listen Notes:** set **`LISTEN_NOTES_API_KEY`** in Vercel (a free key
  from listennotes.com/api) and redeploy. It's now bounded + 7-day-cached, so the
  old `LISTEN_NOTES_ENABLED` flag is no longer needed. Watch usage — the free quota
  is small.

---

## What we've been doing

A multi-session redesign of the **Wavr tab** (`/wavr`, the swipe-deck), plus fixes
to Discovery and the Library tag sync. All shipped to `main` and live on Vercel.

### Done (most recent first)
- **Wavr card = immersive Liquid Glass** (Apple "now playing" look): blurred
  album-art backdrop + frosted glass + crisp floating cover; white text legible on
  any cover; frosted-glass controls with the one Signal-Red Save.
- **Mobile long-press fix:** a hold opens the deck's own overview only — the deck
  cancels the native context menu, disables text selection + the iOS touch-callout,
  and all imagery is `pointer-events-none`. (`e2e` asserts the context menu is
  cancelled.)
- **Layout:** smaller waveform band; roomier tag editor — the "+ tag" field is
  FIRST and chips wrap (no horizontal scrolling).
- **Nothing-brand chrome** on the tab; **settings menu removed** (haptics + waveform
  always on) for more card space.
- **Editable interest tags** on Wavr, backed by `prefs.interests` — the SAME store
  Discovery edits, so add/remove syncs between tabs (and across devices when signed
  in).
- **iTunes Cover Flow overview** (3D perspective + flip-through); fixed a keyboard
  leak where overview arrows also decided the card underneath.
- **Card content:** real release date + duration + community quote; show name links
  to `/show/{id}` (accident-resistant).
- **Audio rewrite:** single `<audio>` element via `useClipWindow` (dropped the
  fragile 3-slot ring) → plays reliably, ~0.9s to audible; shallow clip start; the
  waveform syncs to real play state (flat when silent); **auto-advance** on clip end;
  **drag-to-seek**.
- **Library tag sync fixed at the root:** `show_tags` / `episode_tags` tables were
  never applied to the live DB, so writes silently fell back to localStorage
  (device-local). Applied migrations 004/005 to Supabase (owner-scoped RLS) — tags
  now sync across devices for signed-in users.
- **Discovery:** Today's Picks / ranks now sourced from the user's own interests;
  icon-only tag delete; more content.

### Key files (Wavr)
`src/features/wavr/` — `WavrPage.tsx`, `WavrDeck.tsx`, `CardFace.tsx`,
`DeckControls.tsx`, `LensBar.tsx`, `WaveField.tsx`, `DeckOverview.tsx`,
`useDeckAudio.ts`, `useCardGesture.ts`, `useSwipeDeck.ts`, `ProgressScrub.tsx`.
Pure logic + tests: `src/core/wavr/`, `tests/core/wavr/`. Feed API:
`app/api/wavr/feed/route.ts`.

---

## Open ideas / possible next steps (not started)

- **Extend Liquid Glass to Discovery and Library** — this pass focused on the Wavr
  tab; the same material language could carry to the rest of the app for consistency.
- **Card theme:** the Wavr card is currently always dark-immersive (white text on
  blurred art). Decide whether to keep that or make it adapt to light/dark.
- **Tag migration on sign-in:** library tags added while the DB tables were missing
  still sit in that device's localStorage and won't retroactively sync. Could add a
  one-time "migrate local tags → Supabase" on sign-in (mirrors `migrateLocalPrefs`).
- **Live discussion sources** (Reddit/Douban/etc.) are frequently rate-limited /
  unconfigured from Vercel's IPs, so the deck leans on the precomputed `rec_edges`
  pool + tag search. Revisit if you want richer real-time evidence.

## Caveats to keep in mind
- Cross-device sync of any user data requires being **signed in** (magic-link);
  signed-out = per-device localStorage by design.
- Don't use `rec_edges` score/author_count as ranking/display (no-collab rule).
