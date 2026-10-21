# Two Claude Code sessions: FIX and BUILD

Since 2026-10-21 the work is split in two sessions so that small fixes can go live quickly while a bigger feature is
built without risk. Both read `CLAUDE.md` ("START HERE") and the memory folder; this file says who does what.

| | **FIX session** | **BUILD session** |
|---|---|---|
| Folder | `C:\Users\gayatri\Desktop\claude` | `C:\Users\gayatri\Desktop\claude-build` (a git worktree) |
| Branch | `main` | `build` (one branch per big feature is fine: `build-<name>`) |
| Does | bugs and feedback from users and UAT, wording, small improvements, performance, clean-up | new modules and bigger changes, UI mock-ups first |
| Commits | small, often, straight on `main` | on its own branch; merged into `main` only when the owner says a feature is ready |
| **Deploys to Vercel** | **yes, the only one** | **never** (the CLI uploads the folder; the build folder holds unfinished work) |
| Database migrations | additive only | additive only, and applied only when the owner has agreed |

## Why folders, not just two chats
- `vercel deploy` uploads the **folder**, not git. Half-built features in the same folder would go live with a fix.
- The Supabase database is **one, shared with production**. A migration applied from either session is live for real
  users at once, even if its code is not deployed. So: additive migrations only (new tables/columns/indexes, never
  rename or drop), and a new migration is applied only after the owner has said so.
- Two sessions editing the same files cause conflicts. Separate branches make the overlap visible and mergeable.

## Rules for both
1. Read `CLAUDE.md` "START HERE" and `docs/DECISIONS.md` (latest entries) before starting.
2. Write every decision into `docs/DECISIONS.md` in the same commit as the code.
3. Standing owner rules still apply in both: UI mock-up first for anything new on screen, no backend access for users
   (every setting is a button or form), perf + schema-overlap + leftovers check and a build before calling anything done,
   text in `src/lib/i18n/id.ts`, the app is called **SAPA**.
4. Claude's memory is kept per folder, so the two sessions do not share it automatically. The files in the repo (`CLAUDE.md`,
   `docs/DECISIONS.md`, this file) are the shared truth: anything the other session must know goes there, not only in memory.

## FIX session routine
- Work on `main`. Before deploying: `git pull`, `npx tsc --noEmit`, `npx eslint src --quiet`, `npx vitest run`,
  `npm run build`, then commit, `git push`, `npx vercel deploy --prod --yes`, and check the live site.
- When the BUILD branch has been merged, deploy as usual.
- Keep `build` up to date for the BUILD session: tell the owner when `main` has changed a lot (the BUILD session merges
  `main` into its branch with `git merge main`).

## BUILD session routine
- Work only in `C:\Users\gayatri\Desktop\claude-build` on the `build` branch. Do not run `vercel deploy` there, and do not
  open the main folder to edit it.
- Start of each work day: `git merge main` so fixes arrive early.
- Run the dev server on another port so it does not clash with the FIX session: `npx next dev -p 3001`.
- When a feature is finished and the owner agrees: run all checks, commit, then in the **main folder**:
  `git merge build`, run the checks again, and let the FIX session deploy.
- Never edit `scripts/` (the owner's wipe tools; they are not in git).

## Opening message to paste into each session

**FIX session (folder `Desktop\claude`):**
> You are the FIX session for the SAPA HR app. Read CLAUDE.md "START HERE", docs/SESSIONS.md and the latest entries of
> docs/DECISIONS.md. You work on `main`, you are the only session that deploys to Vercel, migrations are additive only.
> Start by running `git status` and `git log --oneline -5`, then wait for my request.

**BUILD session (folder `Desktop\claude-build`):**
> You are the BUILD session for the SAPA HR app. Read CLAUDE.md "START HERE", docs/SESSIONS.md and the latest entries of
> docs/DECISIONS.md. You work only in this folder on the `build` branch, you never deploy to Vercel, migrations are
> additive only and applied only after I agree. Start with `git merge main`, then wait for my request (UI mock-up first).
