@AGENTS.md

# HR App — PT Cahaya Bukit Perunggu

Real, backend-connected HR application for an Indonesian manufacturing company
(~160 employees). This is not a prototype — build for production quality within
the confirmed scope below.

## START HERE: current state and how we work (handoff, 2026-10-08)

Read this section first. Later sections describe the original design; this one says
what is true now, where things are hosted, and the rules the owner (Gayatri, HR at
PT Cahaya Bukit Perunggu) expects in every session. Where this section and an older
section disagree, this section wins.

### Where things live
- **Code:** the real folder is `C:\Users\gayatri\Desktop\claude`. The copy under
  `OneDrive\Desktop\claude` is an old leftover; do not work there (no current `.env`,
  stale files). GitHub: `gkartika/HRIS`, branch `main`.
- **Database:** ONE Supabase Postgres shared by local dev and production. Anything
  applied to it is live for real users immediately. `DATABASE_URL` is the transaction
  pooler (app), `DIRECT_URL` the session pooler (Prisma CLI). SQLite/`dev.db` is gone.
- **Hosting:** Vercel project `hris` (team `cbp5`). Public site:
  `https://cbp-hris.vercel.app`. Deploys are MANUAL: `npx vercel deploy --prod --yes`
  from the project folder (pushing to GitHub does not deploy). Check the result with
  `npx vercel inspect <url>`.
- **Vercel environment (names only, values are secret and live in Vercel):**
  `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`, `APP_URL`, `MAIL_FROM`,
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Local `.env` has only the database
  and auth values, so emails are printed to the server console in dev and can only be
  really sent from the live site (e.g. submit the public "Lupa kata sandi" form there).
- **Scheduled job:** `vercel.json` runs `/api/cron/daily` at 20:00 UTC (03:00 WIB):
  links check-in/out events to daily attendance records and runs the contract-renewal scan.
- **Files (BPJS cards, evidence photos/PDFs):** stored in the database table `FileBlob`
  (Vercel's disk is read-only). Limit 4 MB per file; large photos are shrunk in the
  browser (`src/components/document-file-input.tsx`). Downloads only through
  `/api/files/[id]`. Course materials and the employee-documents ZIP import can exceed
  Vercel's ~4.5 MB request limit and would need direct-to-storage uploads (not built).

### Database changes: be careful
- Because the database is shared with production, change the schema ONLY with
  additive migrations (new tables/columns, dropping NOT NULL). Write the migration SQL
  by hand in `prisma/migrations/<timestamp>_<name>/migration.sql`, then
  `npx prisma migrate deploy`, then `npx prisma generate`, then restart the dev server.
- NEVER run `npm run db:reset` or `prisma migrate reset` (it would wipe production),
  and avoid `prisma migrate dev`. Ignore the older note in this file that says to use
  `npm run db:migrate`.
- Deleting real data: never do it directly. Write a script in `scripts/` with a
  read-only PREVIEW, a `--rehearse` mode (runs the deletes inside a transaction and
  rolls back), and an `--apply --i-have-a-backup` mode. Show the user the preview, and
  the USER runs `--apply` themselves after taking a Supabase backup. Existing examples:
  `scripts/wipe-employees-only.ts`, `scripts/wipe-ga-data.ts`,
  `scripts/wipe-employee-data.ts`. Run them from `C:\Users\gayatri\Desktop\claude`.
- Test data: create disposable rows (prefix `ZZT`), always delete them afterwards, and
  restore counters/status you changed (e.g. the `EMP-CBP` number sequence, a position's
  status). Scratch scripts go in `scripts/_zz_*.ts` and are deleted right after use; the
  `scripts/` folder is untracked on purpose and is never committed.

### Standing rules from the owner (follow in every session)
1. **Commit, push and deploy only when asked.** Typical request: "commit and push to
   vercel". Use `git add -A -- . ':!scripts'`; commit messages end with the
   Co-Authored-By line given by the session.
2. **Pause before live testing.** Typecheck, lint and Vitest are always fine to run.
   Before starting the dev server or testing in the browser, summarize the change and
   wait for a go-ahead (a plain "test" counts). Once told to test, go ahead.
3. **UI/UX first** when the owner says so: show a clickable mock-up (published artifact)
   and ask which option before building.
4. **No backend work for users.** Every edit or setting must be a button/form in the app.
   Pages need filters, sensible defaults and bulk actions (see the Shift Assignment page
   as the minimum bar). Users cannot code or open the database.
5. **If unsure, ask.** Especially for anything that deletes or overwrites data.
6. Don't leave things manual when a sibling feature is derived (stock, status and similar
   values are computed from the ledger, never stored by hand).
7. Every page must check access itself (the layout's "access denied" still ships the
   page's data). Use `<AccessDenied />` from `src/components/access-denied.tsx`.

### Working notes for this machine (Windows)
- Verify with: `npx tsc --noEmit`, `npx eslint src --quiet`, `npx vitest run`,
  `npm run build`.
- Start the dev server as a bare background command `npm run dev` (no `nohup`/`&`).
  Clear `.next/dev` if Turbopack misbehaves; restart it after any Prisma schema change.
- Bash heredocs often break on long scripts with quotes: write helper scripts with the
  file-write tool and run them with `node` / `npx tsx --env-file=.env`.
- The built-in browser pane is often hidden and then stalls page hydration: open a fresh
  foreground tab per page, wait until the page is hydrated, and drive forms by setting
  values with the native setter and calling `form.requestSubmit()`.
- The company time zone is fixed WIB (UTC+7), see `src/lib/company-time.ts`; date-only
  values are stored as UTC midnight. The work week is Sunday to Saturday.

### What has been built recently (newest last, all deployed unless noted)
- Barang Habis Pakai (APD/ATK consumables) for GA Admin: ledger, stock, history, QR labels,
  reports, import of the old inventory sheets. Admin GA home status board.
- Attendance grid date filter; Exit Clearance form number FR-HC-01-11.
- Employee numbers auto-assigned as CBP-0001, CBP-0002, ... (counter `EMP-CBP`).
- Optimization pass: staged loading of the dashboard, `?tab=` employee tabs, SQL
  aggregates for the consumables report, batched writes, 9 new indexes, shared
  `AccessDenied`, `StatusChip` + `src/lib/status-ui.ts`, `csvResponse`.
- File uploads fixed on Vercel (database storage, browser-side photo shrinking).
- Import safety: a batch can only be written by ONE run at a time (`import-claim.ts`);
  a stuck run can be resumed after 10 minutes; the Import button locks the screen.
- Hire date (Tanggal Bergabung) is optional everywhere.
- Placements: Berlaku Sejak is optional in the import (blank = hire date, else today);
  re-importing a placement the employee already holds UPDATES its start date; HR admins
  can change a placement's start date in place ("Ubah") on the Penempatan tab. A placement
  with no start date counts as already in force (`activeAssignmentWhere`).
- Attendance grid and unresolved-days queue read punches live from the events
  (`src/lib/punch-days.ts`) instead of waiting for the nightly job. A day with check-in
  and check-out counts the full scheduled shift; Setengah Hari is only set by HR (an
  automatic half-day rule was considered and deliberately NOT wanted).

- Code tidying (2026-10-08): `ReasonForm` (cancel with a reason), `WIB_OFFSET_MS`/`DAY_MS`/
  `MONTH_LABELS_ID`/`formatCompanyTime` in `src/lib/company-time.ts`, `createOnboardingCase`,
  `EmployeeCoreFields`/`EmployeeExtraFields`, `t("common.forbidden")`, `countByStatus`.
  Last deployed commit when this was written: 1288f34.
- Workflow gap review (2026-10-08): the owner decides gaps module by module; every decision is in
  `docs/DECISIONS.md` (entries dated 2026-10-08). Built: positions are only Kosong/Terisi and are
  archived in one step, only ONE position may carry HR Manager access, position import keeps the
  line manager when the column is blank (`KOSONGKAN` clears it); recruitment (requester is always
  the logged-in user, seats under Sections can fill a request, "Tutup", edit-and-resubmit after a
  return, vacant-seat warning); onboarding (cancel/reopen, start date follows hire date, courses
  assigned on first placement); one open transfer per employee; offboarding (employee stays active
  through the last working day, nightly job in `/api/cron/daily` deactivates after it, lost assets
  draft a disposal case, cancelled non-renewal can be restarted); leave counts working days only,
  holidays are not lost mandays, approved leave shows on the attendance grid and Excel by itself;
  future-dated moves use the new placement status SCHEDULED (`placement-schedule.ts`).
  Three additive migrations (20261008030000/040000/050000) were already applied to the shared DB.
  Tested live with disposable ZZT data (all removed). The workflow map artifact tracks which gaps
  are decided. Still open from that review: see the artifact (contracts, evaluations, training,
  GA, cross-module items).

- Recruitment pipeline (2026-10-19, built and tested statically, see docs/DECISIONS.md): applicants, tests,
  interviews, offering letter. New tables `Recruitment*` (migration 20261019020000 applied to the shared DB, additive,
  seeds three test kinds with EMPTY question banks, five interview aspects and the settings row). Public pages live
  outside `(app)` under `src/app/cbp-recruitment/` (no login; `/cbp-recruitment` is allowed in `auth.config.ts`).
  Logic: `src/lib/recruitment-candidates.ts` (pure, tested), `recruitment-service.ts` (tests engine, applicants),
  `recruitment-flow.ts` (review, interview, offer, hire hooks), `recruitment-queries.ts`. HR screens:
  `/recruitment/applicants` (Pelamar), the Pelamar block on `/recruitment/[id]`, applicant page, `/recruitment/tasks`,
  `/recruitment/settings`. Employee side: `/internal-jobs` and the Beranda card. The nightly job also closes tests
  whose time ran out. Admin Rekrutmen: separate stand-alone login (role `RECRUITMENT_ADMIN`, no employee
  record) created by Admin SDM at `/admin/recruitment-admins`; runs the pipeline and the internal applicant's move.
  Migrations 20261019020000 and 20261019040000 are applied.

### Current data and open items
- Production data: 185 employees (CBP-0001 ...) and 185 positions imported; 3 admin
  logins: Admin SDM `humancapital@ptcbp.com`, Admin GA `cahayabp.ga@gmail.com` (changed
  from `ga.admin@cbp.demo`; a password-reset email was sent), and Training Admin
  `training.admin@cbp.demo`. Next step on the owner's side: import the placements
  (penempatan) file, then check the org chart.
- `scripts/wipe-ga-data.ts` was prepared for emptying the GA module (1 asset, 1 location,
  counters); whether the owner ran it is not recorded here, so check before assuming.
- Not done on purpose (offer, don't assume): deeper import speed-ups (a large import can hit
  the server time limit and needs a retry), an "Otomatis/Dikonfirmasi" marker for auto-filled
  placement dates, camera QR scanning (needs a real phone to test), and direct-to-storage uploads
  for files over 4.5 MB (course materials, employee-documents ZIP). The code tidying that used to
  be on this list (shared ReasonForm, date/time helpers, onboarding creator, employee form fields,
  the "Anda tidak memiliki akses." string) is DONE (commit 1288f34).
- Detailed history of decisions: `docs/DECISIONS.md`. Optimization plan:
  `C:\Users\gayatri\.claude\plans\cheeky-stargazing-firefly.md`.

## Source-of-truth order (SRC-01..SRC-06 in the Build Guide)

When the brief, field blueprint, prototype, or existing code in this repo
appear to conflict, resolve in this order:

1. **HR App Build Guide** (Google Sheet, "HR App Build Guide - Claude Code") —
   highest authority for product requirements, including later edits recorded
   in its own "16 Decisions" tab.
2. **HR App Data Fields Blueprint** (Google Sheet) — authority for fields, data
   types, ownership, sensitivity tiers, and dataset relationships. It is a
   field-level data dictionary, **not** a list of screens to build 1:1.
3. **Decisions recorded in [docs/DECISIONS.md](docs/DECISIONS.md)** — explicit
   choices made while building this repo.
4. **`HCWorkflowPrototype_1.jsx`** (in the user's Downloads folder, referenced
   here as a historical artifact) — workflow/behavior reference ONLY. Its
   flat in-memory data model (single `roles` array on a person, no separate
   accounts, no real assignments/positions) is explicitly NOT the data model
   or architecture authority. Do not preserve its simplifications just
   because code already exists.
5. This repo's own code, once (1)-(4) don't resolve the question — prefer
   consistency with what's already built over introducing a new pattern.

**Do not** ask for a document-only phase review (ERDs, screen lists, mockups).
Per SRC-06, the review checkpoint is always a running, clickable app. Plan and
document internally as needed, but don't block progress waiting for approval
of a diagram.

## Hard scope

In scope: **Employee Management**, **Organizational Development**,
**General Affairs**.

Explicitly excluded — do not build, even if asked to "improve" something
nearby:
- ISO/IMS management (document control, CAPA, audits, risk registers)
- Employee Relations case management (grievance, discipline, investigations)
- Odoo integration of any kind
- Payroll calculation — salary slips are imported for employee viewing only,
  never computed here

## Core data model — keep these concepts separate

- **Employee** — the person.
- **Job** — standardized reusable role definition, independent of people or
  seats.
- **Position** — one approved organizational seat (`position_id`); can be
  vacant; must keep existing when vacant.
- **Assignment** — the effective-dated relationship between one Employee and
  one Position. Type is one of `PRIMARY | ADDITIONAL | ACTING | TEMPORARY`.
- **User Account** — login identity, separate from Employee (an admin account
  may exist with no linked Employee at all).

An Employee may hold multiple **concurrent** Position Assignments (normally
one Primary + any number of Additional/Acting/Temporary). Never overwrite
assignment history on a move — close the old assignment's `effectiveTo` and
create a new one. `effectiveTo` is a half-open bound (`effectiveFrom <= date
< effectiveTo`) — the first date a row is no longer active, not the last date
it is; this matters when a Movement closes one assignment and opens another
on the same calendar day. `reportsToPositionId` is the *only* saved
parent-child authority for the org chart — never infer hierarchy from names,
departments, or job levels. **Director is the single organization root**
(ORG-15): one Position with `positionType: DIRECTOR` and
`reportsToPositionId: null`; every `DEPARTMENT_HEAD` Position must chain up
to it. Occupying the Director Position never grants admin/system access by
itself — that only ever comes from `AccountRole`.

Employee Master's identity/compliance fields (`noKk`, `namaIbuKandung`,
`educationLevelId`, `ptkpStatusCode`, `ktpFileId`, `kkFileId`) are all
nullable — existing records are flagged incomplete
(`src/lib/employee-completeness.ts`), never blocked. `educationLevelId` and
`ptkpStatusCode` reference admin-maintained lookup tables
(`EducationLevel`, `PtkpStatus`; manage via `/admin/education-levels` and
`/admin/ptkp-status`), never free text.

## Terminology (Bahasa Indonesia UI, DEC-003)

| Concept | Indonesian term used in UI |
|---|---|
| Job | Jabatan Standar |
| Position | Posisi Organisasi |
| Assignment | Penempatan |
| Employee | Karyawan |
| Org Unit | Unit Organisasi |
| Account | Akun Pengguna |

All frontend-facing strings live in [src/lib/i18n/id.ts](src/lib/i18n/id.ts) —
never hardcode UI copy in a component. Technical/DB identifiers stay in
English.

## Working rules

- **Small increments, running app each time.** Don't build all 39 datasets
  from the Data Fields Blueprint at once — only what the current phase needs.
  See [docs/DECISIONS.md](docs/DECISIONS.md) for what's deliberately deferred.
- **Backend-enforced permissions.** Every server action / route handler that
  touches HR data must call `requireSession()` from
  [src/lib/require-session.ts](src/lib/require-session.ts) plus the relevant
  check from [src/lib/permissions.ts](src/lib/permissions.ts) (`canListEmployees`,
  `projectEmployee`, `canViewEmployeeDocument`, etc.). The two files are split
  on purpose — `permissions.ts` has zero Next.js-runtime imports so its pure
  predicates are unit-testable under Vitest; `require-session.ts` is the only
  place that touches `next/navigation` + the NextAuth instance. Hiding a nav
  link is not access control.
- **Audit everything sensitive.** Call `logAudit()` from
  [src/lib/audit.ts](src/lib/audit.ts) for logins, sensitive views, mutations,
  imports, and file downloads. `AuditLog` rows are append-only — never update
  or delete one from application code.
- **No hard deletes of HR history.** Use status fields and `effectiveTo`, not
  row deletion, for anything Employee/Assignment/Position/Contract-related.
- **Private files only.** Never serve an HR document from `public/` or a
  permanent signed URL. Route all downloads through
  `/api/files/[id]` ([src/app/api/files/[id]/route.ts](src/app/api/files/[id]/route.ts)),
  which re-checks permission and audits on every request. See
  [src/lib/file-storage.ts](src/lib/file-storage.ts).
- **Database migrations, always, and additive only.** Change `prisma/schema.prisma`, write the
  migration SQL by hand, then `npx prisma migrate deploy` (see "Database changes: be careful" at the
  top: the database is shared with production, so never run `db:reset`).
- **Fictional data only in dev.** Never put real employee/salary/bank/medical
  data in this repo or its seed data. `prisma/seed.ts` is the canonical set of
  development-safe demo accounts and records.

## Repo map

- `prisma/schema.prisma` — data model (see inline scope-note comment at top).
- `prisma/seed.ts` — demo accounts + fictional org/employee/assignment data,
  including the Director/Department Head hierarchy and lookup-table rows.
  Idempotent — safe to rerun against an existing database.
- `src/lib/auth.config.ts` / `src/lib/auth.ts` — split on purpose: `auth.ts`
  has the Credentials provider (needs Node/Prisma/bcrypt); `auth.config.ts` is
  the edge-safe subset used by `src/proxy.ts` (Next.js 16's replacement for
  `middleware.ts`) so route-protection redirects don't need a Node runtime.
- `src/lib/permissions.ts` / `src/lib/require-session.ts` — RBAC + field-level
  projection (pure, unit-tested) vs. session-fetching (Next.js-runtime-only).
- `src/lib/audit.ts`, `src/lib/file-storage.ts` — controls foundation.
- `src/lib/validation/employee-fields.ts` — No. KK format + document
  MIME/extension/size validation (DM-17, CTL-12), unit tested.
- `src/lib/employee-completeness.ts` — computes which DM-17..DM-20 fields are
  still missing on a given Employee record; never a stored column.
- `src/lib/org-chart.ts` — as-of-date occupancy reconstruction and
  `computeStructureWarnings()` (Director-root / Department-Head-hierarchy
  validation, ORG-15), unit tested.
- `src/lib/recruitment-candidates.ts`, `recruitment-service.ts`, `recruitment-flow.ts` — the applicant pipeline
  (see the 2026-10-19 entry in docs/DECISIONS.md).
- `src/lib/recruitment.ts` — pure Recruitment Request logic (fulfillment
  counts, status transitions, cancellation-status eligibility, request-number
  formatting), unit tested. See `src/lib/position-occupancy.ts` — shared
  `isPositionOccupiedByPrimary()` / `syncPositionStatus()`, used by the
  direct "Pindahkan ke Posisi Baru" Movement action
  (`employees/[id]/assignment-actions.ts`), the formal Movement Request flow
  below, the Assignment CSV import, and Recruitment Request fulfillment so a
  Position can never end up with two active PRIMARY assignments.
- `src/lib/hr-manager.ts` — `getActiveHrManagerPositions()`: the live,
  Prisma-backed derivation of HR Manager authority from
  `Position.grantsHrManagerAccess` + an employee's currently-ACTIVE,
  effective-dated Assignments (ACC-14). Split out from `permissions.ts` for
  the same reason as `require-session.ts` — keeps the pure predicates
  (`isHrManager`, `canApproveRecruitmentRequest`,
  `canCancelRecruitmentRequest` in `permissions.ts`) dependency-free and unit
  testable. Called fresh on every page/action — never cached in the
  session/JWT — so access ends automatically the moment the granting
  Assignment's `effectiveTo` passes.
- `src/app/(app)/recruitment/` — the simplified Recruitment Request flow
  (DEC-013, DM-21..23, WF-13/15, DM-25): list, submit (`new/`), a Department
  Manager/Head (Job level 3B, `src/lib/dept-head.ts`) approval gate ahead of
  the HR Manager (added 2026-07-30, amending WF-15/DEC-016 — see
  docs/DECISIONS.md), detail with approve/reject/return
  (HR-Manager-Position-only, WF-15) and cancel (Requester/HR-Manager/HR-Admin,
  DM-25), and the transactional "create Employee from this request" form
  (`[id]/create-employee/`, HR-Admin-only) that atomically creates the
  Employee, Primary Assignment, and `RecruitmentRequestFulfillment` link.
  Manpower, Candidate, and Selected Person modules are explicitly out of
  scope.
- `src/lib/movement.ts` — pure Movement Request logic (status-transition
  eligibility, STATUS_CHANGE-vs-Position-change validation, job-level-
  direction validation, request-number formatting), unit tested.
  `src/lib/manager-scope.ts`'s `isDirectManagerOfEmployee()` is still used
  by Contract renewal but no longer by Movement (see below).
- `src/app/(app)/movements/` — **"Perubahan Posisi"** (refactored in place
  2026-08-03, see docs/DECISIONS.md — same route/model, not a new module):
  Promosi/Mutasi/Demosi only, going forward. `ROTATION`/`STATUS_CHANGE`
  remain valid historical `MovementType` values (never removed from the
  enum/DB) but the submit form and `submitMovementRequest` no longer accept
  them (`isPerubahanPosisiType`) — any existing row of those types renders
  as a read-only archive on the detail page, no action controls. Submit
  eligibility is Job level "3A"/"3B" scoped to the target employee's own
  Department (`src/lib/level3-scope.ts`'s `isLevel3ForEmployeeDepartment`,
  walking `OrgUnit.parentUnit` up to the nearest DEPARTMENT tier) — not
  "direct manager" anymore. Workflow: Department Head 3B
  (`src/lib/dept-head.ts`, reused from Recruitment, `PENDING_DEPT_HEAD`
  status, never bypassed — a routing-configuration error blocks submission
  outright if no *other* level-3B holder exists in that department) → HR
  Manager (`SUBMITTED` → `APPROVED`/`REJECTED`/`RETURNED`, same as before)
  → HR Admin executes (`executeMovementRequest`, using the request's own
  stored `currentAssignmentId` rather than re-deriving "the Primary"). HR
  Admin also adds HR-only supporting fields (`updateMovementHrFields`:
  3-month attendance, evaluation reference, confidential notes) — never
  visible to the requester or the affected employee. Cancel stays
  Requester/HR-Manager/HR-Admin. This is a *formal* path alongside the
  pre-existing direct "Pindahkan ke Posisi Baru" HR-Admin action, same
  direct-vs-formal-request precedent as DEC-014.
- `src/lib/onboarding.ts` — pure Onboarding Case logic (`computeOnboardingStatus()`
  deriving Not Started/In Progress/Overdue/Complete live from the three
  completion flags, never stored; case-number formatting), unit tested.
  `src/app/(app)/onboarding/` (LIF-03, Data Fields Blueprint "12
  Onboarding"): list and detail with three admin-owned completion toggles
  (contract/mandatory-training-material/assets, each with its own Primary
  Owner per the blueprint, plus HR Admin). An `OnboardingCase` is created
  automatically inside the same transaction as every new Employee — both
  direct creation (`employees/actions.ts`) and Recruitment fulfillment
  (`recruitment/actions.ts`) — never a separate step. Visibility is "Admin
  shared" (HR/Training/GA Admin + active HR Manager), not self-view.
- `src/lib/contract.ts` — pure Contract + renewal logic
  (`computeExpiryUrgency()` deriving the 90/60/30/7-day/Expired reminder
  state live from `status`/`endDate`, never stored; WF-10 status-transition
  eligibility per step; contract-number formatting matching the blueprint's
  own 3-digit example). `src/app/(app)/contracts/` (WF-10, LIF-08..12, Data
  Fields Blueprint "08 Contracts"): a single `Contract` model whose
  `status` carries the full pipeline — an existing ACTIVE contract nearing
  its own end date moves through Department-Manager-recommends ->
  HR-Manager-decides states; once approved, a **new** Contract row (linked
  via `renewedFromContractId`) moves Draft -> Released -> Signed -> Active
  while the old one flips to Ended. HR Admin creates the baseline contract
  directly and handles Draft/Release/Activate; the employee signs their own
  contract only. `canViewContractDetail()` in `permissions.ts` (wider than
  `canViewContract`, used for the Employee-profile summary list) also
  admits the Department Manager and active HR Manager, who must reach the
  detail page to act on it — a real bug caught during this feature's own
  live verification.
- `src/app/(app)/my-positions/`, `approvals/`, `hr-dashboard/`, `hr-reports/`
  — the personal HR Manager workspace (ACC-15), each gated by
  `getActiveHrManagerPositions()`. `approvals/` lists pending items from both
  Recruitment and Movement. Dashboard and Reports are intentionally empty
  placeholders, deferred to a later increment. `/profile` (Phase 0) is
  reused for "My Profile" rather than duplicated.
- `src/lib/import-export/` — CTL-13 universal import/export framework: one
  module per dataset (`employees.ts`, `org-units.ts`, `jobs.ts`,
  `positions.ts`, `assignments.ts`) each exporting `templateHeaders`/
  `dryRun`/`commitRow`/`exportData`; `registry.ts` maps a dataset key to its
  module; `employee-documents-zip.ts` is the ZIP+manifest case for
  file-bearing records. `src/app/(app)/import/` is the hub UI + server
  actions; `/api/import-export/template|export/[dataset]` are the shared
  route handlers.
- `src/app/(app)/` — the authenticated app shell (role-aware nav in
  `layout.tsx`) and all feature pages, including `admin/education-levels/` and
  `admin/ptkp-status/` (lookup-table CRUD) and each employee's
  `identity-documents-panel.tsx` (KTP/KK upload).
- `*.test.ts` files sit next to the module they test (e.g.
  `src/lib/permissions.test.ts`) — run with `npm test`.

## Commands

```bash
npm run dev          # start the app (http://localhost:3000)
npm run db:migrate   # DO NOT USE: the database is shared with production, see the top of this file
npm run db:seed      # (re)seed demo data — safe to re-run, upserts
npm run db:studio    # Prisma Studio (visual DB browser)
npm run db:reset     # DO NOT RUN: it would wipe the production database
npm test             # run the Vitest unit test suite
```
