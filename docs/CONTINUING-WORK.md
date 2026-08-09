# Continuing work on Wavr — a durable playbook

This file lives in the repo on purpose: it travels with git, so it's available on
every device. The chat transcript does **not** — read "Where things live" below.

---

## 0. The one thing to remember

**Git is the source of truth, not the chat.** Every change is committed to
`main` and pushed to GitHub, with detailed commit messages written to be read
later. If you ever lose the conversation, `git log` + the code + this doc + the
handoff note are enough to fully reconstruct where we are.

---

## 1. Coordinates (exact names)

| Thing | Value |
|---|---|
| Local project folder | `/Users/aaron.liu/Gdrive/Codeverse/WaveFM` |
| GitHub repo | `github.com/aaronchao/wavefm` |
| Default / working branch | `main` |
| Dev server | `npm run dev` → http://localhost:3000 |
| Supabase project (id / name) | `mkosirkbbnmitobtckij` / `wavefm` |
| Hosting | Vercel (Hobby, free) — auto-deploys on push to `main` |
| Handoff snapshot (update each session) | `docs/SESSION-HANDOFF.md` |

---

## 2. Where things live (what syncs, what doesn't)

| Item | Location | Syncs across devices? |
|---|---|---|
| All code | the repo → `origin/main` | ✅ via GitHub |
| Commit messages (the durable record) | git history | ✅ |
| DB schema (migrations) | applied live to Supabase | ✅ already in prod |
| **Chat transcript** | `~/.claude/projects/-Users-aaron-liu-Gdrive-claudeT-wavefm/` | ❌ this Mac only |
| **Claude memory notes** | `~/.claude/projects/-Users-aaron-liu-Gdrive-claudeT-wavefm/memory/` | ❌ this Mac only |

The Gdrive folder syncs the *code*, but the transcript/memory sit under `~/.claude`,
which Gdrive doesn't cover.

---

## 3. How to resume, by surface

**Same Mac, terminal (full transcript):**
```bash
cd /Users/aaron.liu/Gdrive/Codeverse/WaveFM
git pull
claude --continue     # resume THIS conversation (most recent in this folder)
# or: claude --resume  # pick from a list of past sessions in this project
```
`--continue` / `--resume` only work from the same folder on the same machine.

**Claude Code desktop app (this Mac):** open the same project folder — it reads
the same local history, so recent sessions resume.

**Different computer, or Claude Code on the web (`claude.ai/code`, also works in a
phone browser):** the transcript isn't there. Do:
```bash
git clone https://github.com/aaronchao/wavefm   # first time
cd wavefm && git pull
claude
```
then paste the **Resume prompt** (section 6) so the fresh session catches up.

**Claude phone app (regular chat):** not Claude Code — it can't run tools against
the repo. Use `claude.ai/code` in the phone browser instead.

---

## 4. ✅ ALWAYS do at the START of work

1. `cd /Users/aaron.liu/Gdrive/Codeverse/WaveFM`
2. `git pull` — get anything pushed from another device.
3. `git status` — confirm a clean tree and that you're on `main`
   (`git branch --show-current` → `main`).
4. `npm install` — only if `package.json` / `package-lock.json` changed since last time.
5. `npm run dev` — start the dev server (leave it running) for in-browser checks.
6. Resume the session (`claude --continue`) or paste the Resume prompt on a new device.
7. Skim `docs/SESSION-HANDOFF.md` for where we left off and any open items.

---

## 5. ✅ ALWAYS do BEFORE finishing work

> **Terminal vs chat:** everything in this section is **shell commands** — run them
> in a terminal, or in Claude Code just say *"run the full verification and push"*
> and Claude runs them for you (or prefix a line with `!` to run it directly). They
> do **not** work in the regular Claude phone chat app.

Run the **full verification suite** (the same gates CI runs) — all must pass.
Copy-paste one-liner (`&&` stops at the first failure, ends on `git status`):
```bash
npx tsc --noEmit && npm run lint && npm run test && npm run e2e && npm run build && git status
```
What each gate is:
```bash
npx tsc --noEmit        # 1. TypeScript strict, no errors
npm run lint            # 2. eslint clean
npm run test            # 3. unit tests (vitest) — /src/core changes MUST have tests
npm run e2e             # 4. Playwright end-to-end
npm run build           # 5. production build succeeds
```
Then (commit/push is kept separate — messages need real thought, and work goes in
logical chunks, not one blob):
```bash
git add <files>                                   # stage one logical group
git commit -m "type(scope): what changed and why"  # end with the Co-Authored-By trailer
git push origin main                              # Vercel auto-deploys
git status                                        # confirm clean tree, nothing unpushed
```
And:
6. `git status` — review everything staged; **double-check no secrets/keys** slipped in.
7. Commit in **logical chunks** (not one giant commit), with clear messages.
   End commit messages with the `Co-Authored-By:` trailer.
8. `git push origin main` (Vercel auto-deploys).
9. `git status` again — confirm a **clean working tree** and nothing unpushed.
10. Remove any scratch/temp files (e.g., `.scratch-*.mjs`); use
    `$CLAUDE_JOB_DIR/tmp` for temporary files, never the repo root.
11. **Update `docs/SESSION-HANDOFF.md`** with what changed and what's next, and
    push it — that's what makes the next pickup (on any device) trivial.

---

## 6. Resume prompt (paste into a fresh session on any device)

> This is a **chat message, not a shell command** — paste it into the Claude prompt
> (the conversation box), not the terminal. Works on any Claude Code surface:
> terminal CLI, desktop app, or `claude.ai/code` on web/phone browser.

```
This is the wavefm/Wavr repo (Next.js podcast-discovery app). Before we continue:
read docs/SESSION-HANDOFF.md, then `git log --oneline -25` on main and the current
src/features/wavr/* files, and summarize where we are. Everything is committed +
pushed. I want to continue from there.
```

---

## 7. Project guardrails (from CLAUDE.md — don't break these)

- **WEB_ONLY** — responsive web app; no native/React Native.
- **FREE** — must build + host for $0 (Vercel Hobby + Supabase free + free podcast
  APIs). **Never** add a paid key, paid host, or required paid service.
- **PROXY_EXTERNAL_CALLS** — the browser never calls third-party APIs directly;
  everything goes through `/app/api/*` route handlers.
- **PURE_CORE** — logic in `/src/core` has zero React/Next imports and is unit-tested.
- **NO collaborative filtering** — Wavr ranks on the user's OWN declared interests +
  own engagement only; never cross-user data (enforced by
  `tests/core/wavr/no-collab.test.ts`; `rec_edges` score/author_count are off-limits
  as ranking/display signals — only `evidence` text may be used).
- **Definition of done (per change):** tsc strict passes, lint clean, `/core` changes
  have unit tests, feature degrades gracefully when an external API is blocked/offline,
  no new paid dependency, one-click save/like/open preserved.

---

## 8. Database changes

Migrations live in `supabase/migrations/`. Writing a migration file does **not**
apply it — apply it to the live project (`mkosirkbbnmitobtckij`) via the Supabase
MCP (`apply_migration`) or the Supabase SQL editor, then re-check with the security
advisor (every user table needs owner-scoped RLS: `auth.uid() = user_id`). The app
silently falls back to `localStorage` when a table is missing, so a forgotten
migration looks like "data won't sync across devices" — check the table exists in
prod when sync misbehaves.

> Cross-device sync of any user data (saved shows, interests, tags) requires being
> **signed in** (magic-link). Signed-out state is per-device localStorage by design.
