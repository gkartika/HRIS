# Technical & Product Decisions

Material decisions made while building this app, in addition to the Decision
Log tab (16 Decisions) in the HR App Build Guide. Newest first.

## 2026-07-28 — Phase 0 foundation decisions

### Stack
- **Next.js 16 (App Router) + TypeScript**, single deployable app (frontend +
  server actions/route handlers), rather than a separate frontend/backend.
  Simpler to run (`npm run dev`, one process) and still fully
  backend-persisted — no mocked data anywhere.
- **Prisma ORM 7 + SQLite** for development, via the `@prisma/adapter-better-sqlite3`
  driver adapter (Prisma 7 requires an explicit adapter; there's no more
  `url` field in `schema.prisma`). SQLite was chosen over a local Postgres
  install so the app runs with zero external services. **For staging/production,
  switch the datasource provider to Postgres** — the schema uses no
  SQLite-specific features, so this is a low-risk migration when that
  environment is set up (needs credentials from the user — a legitimate stop
  point, not done yet).
- **NextAuth (Auth.js) v5, Credentials provider, JWT sessions**, bcrypt-hashed
  passwords. No external OAuth provider — this needs no third-party
  credentials, which lets Phase 0 ship without asking for anything. Account
  lockout after 5 failed attempts (`accountStatus = LOCKED`), tracked via
  `Account.failedLoginCount`. This answers Build Guide item **CTL-07** for
  Phase 0; MFA and a self-service "forgot password" flow are not built yet —
  flagged for a later phase since they need a decision on email delivery
  (also blocked on **DSH-10**, notification channel, which is marked "Needs
  Decision").
- **papaparse** for CSV import parsing; **lucide-react** for icons (carried
  over from the prototype's visual language, since that part is a reasonable
  behavioral reference).

### Split auth config (auth.config.ts vs auth.ts vs proxy.ts)
Prisma's driver adapter uses native bindings (`better-sqlite3`), which cannot
run in the Edge runtime that Next.js route-protection middleware uses by
default. Following the standard Auth.js v5 pattern, the NextAuth config is
split: `auth.config.ts` has no providers and is edge-safe (used by
`src/proxy.ts`, Next 16's renamed `middleware.ts`); `auth.ts` adds the
Credentials provider (which touches Prisma/bcrypt) and is only ever imported
from server actions / route handlers / RSCs, which run on Node.

### `record_id` vs. natural business ID
The Data Fields Blueprint's "01 Common Fields" tab gives every entity a
generic `record_id`, while most entities also have their own natural key
(`employee_id`, `position_id`, etc.) — the blueprint doesn't say whether these
are the same field or two different ones. **Decision:** each Prisma model has
exactly one primary key (`id`, a cuid), and a separate unique
human-facing business code where the blueprint calls for one (e.g.
`Employee.employeeNumber`, `Position.positionCode`, `Job.jobCode`,
`OrgUnit.unitCode`). No redundant second ID column.

### Not every Common Field was carried through literally
The blueprint's Common Fields (`record_status`, `attachment_ids`, etc.) are
inherited *conceptually* rather than as literal columns everywhere:
- Instead of one generic `record_status` string, each entity that needs a
  status uses its own typed enum (e.g. `PositionStatus`, `AssignmentStatus`)
  for type safety. A generic status column would need runtime validation
  Prisma can give us for free with enums.
- `attachment_ids` is modeled as the real `FileObject` relation
  (`Employee.files`), not a loose array of IDs.
- Audit fields (`created_by_account_id`, etc.) are present where mutation
  history matters; a full "every table has createdBy/updatedBy" pass is
  deferred until a phase that actually edits these records after creation
  (Phase 0/1 mostly *creates* records once via seed/import).

### Scope of the Prisma schema (what's built vs. deferred)
Only modeled what Phase 0 (Foundation) and Phase 1 (Employee & Organization)
need: `Account`, `AccountRole`, `Employee`, `OrgUnit`, `Job`, `Position`,
`Assignment`, `AuditLog`, `ImportBatch`/`ImportRow`, `FileObject`.
**Deliberately not modeled yet** (per the Build Guide's own phase plan, not
scope-cut): Contracts, Candidates/Recruitment, Manpower Plan, Work
Schedules/Attendance/Leave/Time Adjustments, Evaluation/KPI, Competency,
Training, Salary Slips, Asset Master/Assignments, GA Service Requests,
Resignation/Exit Clearance, Approval Rules, Business Rules, Notifications.
Building all 39 blueprint datasets now, before Phase 2+ is reviewed, would
violate "work in small, testable increments" and "connected screens, not one
disconnected screen per dataset" (**SCP-10**).

### "Master Data Lists" (undefined lookup entity in the blueprint)
The blueprint references a "Master Data Lists" dataset as the `Related
Dataset` for many dropdown fields (gender, employment status, etc.) but never
defines it as an actual sheet/entity. **Decision:** for the small, structural,
rarely-changing lists needed so far (`Gender`, `EmploymentStatus`, `UnitType`,
`PositionType`, `PositionStatus`, `AssignmentType`), use native Prisma enums
— they're not going to need admin editing and enums give compile-time safety.
A generic admin-editable lookup table (matching the "Business Rules:
editable policy numbers... without code" philosophy) is deferred until a
phase that actually needs runtime-configurable lists (e.g. GA asset
categories, leave types) — building it now would be speculative.

### Manager/Approver is derived, never stored
Per **ACC-05**, "Manager" is not a role flag on `Account` — it's computed at
request time by checking whether any `Position.reportsToPositionId` points at
the current user's `Employee.currentPositionId` (see `getIsManager()` in
`src/app/(app)/layout.tsx` and `/team/page.tsx`). This means promoting someone
or moving a report to a different position immediately and correctly changes
who sees "My Team" — no stale flag to keep in sync.

### Field-level projection implemented as key omission
`projectEmployee()` in `src/lib/permissions.ts` deletes disallowed keys from
the Employee object per role (HR Admin: everything; Training Admin:
identity + org, no financial/bank/tax/BPJS/national ID; GA Admin: name +
number + org placement only; self: everything for your own record) rather
than nulling them out, so the UI naturally renders nothing for a field it
never received. The same reasoning was applied to the "Documents" list on the
employee detail page after testing surfaced a gap: it was showing file
names/categories to GA Admin even though `/api/files/[id]` would 403 the
actual download. Fixed so the file list itself is only fetched for
self/HR Admin.

### Private file storage
Files are saved to `PRIVATE_FILE_STORAGE_ROOT` (default `./storage/private/`,
gitignored, outside `public/`) and only ever served through
`/api/files/[id]`, which re-checks the caller's session on every request
(owner or HR Admin only for now) and writes a `CTL-02` audit event. There is
no signed/permanent URL — this satisfies **CTL-06** without needing an
external object-storage provider for Phase 0. Revisit if/when GA or Training
admins need scoped access to specific document categories.

### Demo accounts and seed data (all fictional)
Five accounts, password `Demo12345!` for all:
- `hr.admin@cbp.demo` — HR_ADMIN, `adminScope=PEOPLE_PAYROLL`, no linked
  Employee (demonstrates **ACC-01**: admin accounts don't need one).
- `training.admin@cbp.demo` — TRAINING_ADMIN, `adminScope=TRAINING`.
- `ga.admin@cbp.demo` — GA_ADMIN, `adminScope=ASSETS`.
- `budi.manager@cbp.demo` — EMPLOYEE_LOGIN, linked to fictional employee
  "Budi Santoso" (Kepala Seksi Produksi), who has one direct report — this is
  the "Manager/Approver" demo account, with manager status derived, not
  stored (see above).
- `siti.karyawan@cbp.demo` — EMPLOYEE_LOGIN, linked to fictional employee
  "Siti Rahayu" (Staf Produksi, reports to Budi's position).

A second, vacant Staff position was seeded alongside Siti's to demonstrate
"a Position can be vacant and must continue to exist without an employee."
Multiple *concurrent* Assignments per employee (Additional/Acting/Temporary)
were deliberately **not** seeded in Phase 0 — that's a Phase 1 acceptance
scenario per the Build Guide's own phase table, not something Phase 0 needs
to prove.

### Organization chart placeholder
`/organization` currently renders a flat table of Positions (reports-to,
current holder, status), explicitly labeled as a placeholder. The Build
Guide (**ORG-03/ORG-04/ORG-13**) requires a conventional top-down chart with
d3-hierarchy-based layout, zoom/pan/expand-collapse, and multi-position
badges — building that properly is Phase 1 work (it depends on having real
multiple-assignment data to test against). Shipping a plain table as the
*final* org chart would violate ORG-04's explicit rejection of table/grid
layouts, so the page is clearly marked as a data foundation, not the
deliverable.

### Indonesian terminology (DEC-003)
Adopted the Build Guide's own recommendation without waiting for a separate
approval round, since SRC-06 says non-blocking product decisions shouldn't
stall a running-app checkpoint: Job → **Jabatan Standar**, Position →
**Posisi Organisasi**, Assignment → **Penempatan**. Recorded here so it's
easy to revisit before UI finalization, per the Decision Log's own note.

### Not yet decided (flagged, not blocking)
- **DEC-005** (salary-slip capability owner), **DEC-006** (approval routing
  after a Position change — snapshot vs. dynamic), **DEC-007** (performance
  evaluation with multiple Positions), **DEC-008** (notification channels) —
  none of these affect Phase 0/1 and are left open per the Build Guide's own
  Decision Log.
- Production auth hardening (MFA, password reset via email, session
  revocation UI) needs the notification-channel decision (DEC-008) first —
  will revisit alongside Phase 5 (dashboards & notifications) or sooner if
  the user wants it earlier.
