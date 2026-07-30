@AGENTS.md

# HR App — PT Cahaya Bukit Perunggu

Real, backend-connected HR application for an Indonesian manufacturing company
(~160 employees). This is not a prototype — build for production quality within
the confirmed scope below.

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
- **Database migrations, always.** Change `prisma/schema.prisma`, then run
  `npm run db:migrate`. Never hand-edit `dev.db`.
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
  (DEC-013, DM-21..23, WF-13/15, DM-25): list, submit (`new/`), detail with
  approve/reject/return (HR-Manager-Position-only, WF-15) and cancel
  (Requester/HR-Manager/HR-Admin, DM-25), and the transactional "create
  Employee from this request" form (`[id]/create-employee/`, HR-Admin-only)
  that atomically creates the Employee, Primary Assignment, and
  `RecruitmentRequestFulfillment` link. Manpower, Candidate, and Selected
  Person modules are explicitly out of scope.
- `src/lib/movement.ts` — pure Movement Request logic (status-transition
  eligibility, STATUS_CHANGE-vs-Position-change validation, request-number
  formatting), unit tested. `src/lib/manager-scope.ts`'s
  `isDirectManagerOfEmployee()` is the Prisma-backed check (parallel to
  `hr-manager.ts`) for "is this account the target employee's direct
  manager" — resolved fresh, never stored.
- `src/app/(app)/movements/` — the Movement Request flow (LIF-04, Data
  Fields Blueprint "28 Movement Requests"): list, submit (`new/`, reached
  from a "Ajukan Mutasi" link on the Employee detail page), detail with
  approve/reject (HR-Manager-Position-only) and execute
  (`executeMovementRequest`, HR-Admin-only — performs the actual Assignment
  close-old/open-new, or just updates `employmentStatus` for a
  STATUS_CHANGE request) and cancel (Requester/HR-Manager/HR-Admin). This is
  a *formal* path alongside the pre-existing direct "Pindahkan ke Posisi
  Baru" HR-Admin action, same direct-vs-formal-request precedent as DEC-014.
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
npm run db:migrate   # create/apply a migration after editing schema.prisma
npm run db:seed      # (re)seed demo data — safe to re-run, upserts
npm run db:studio    # Prisma Studio (visual DB browser)
npm run db:reset     # drop + recreate + reseed the dev database
npm test             # run the Vitest unit test suite
```
