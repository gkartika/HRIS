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
create a new one. `reportsToPositionId` is the *only* saved parent-child
authority for the org chart — never infer hierarchy from names, departments,
or job levels.

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
  touches HR data must call through [src/lib/permissions.ts](src/lib/permissions.ts)
  (`requireSession`, `canListEmployees`, `projectEmployee`, etc.). Hiding a nav
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
- `prisma/seed.ts` — demo accounts + fictional org/employee/assignment data.
- `src/lib/auth.config.ts` / `src/lib/auth.ts` — split on purpose: `auth.ts`
  has the Credentials provider (needs Node/Prisma/bcrypt); `auth.config.ts` is
  the edge-safe subset used by `src/proxy.ts` (Next.js 16's replacement for
  `middleware.ts`) so route-protection redirects don't need a Node runtime.
- `src/lib/permissions.ts` — RBAC + field-level projection for Employee data.
- `src/lib/audit.ts`, `src/lib/file-storage.ts` — controls foundation.
- `src/lib/import/employee-import.ts` — CSV parse/validate for the import
  preview flow; `src/app/(app)/import/` is the UI + server actions.
- `src/app/(app)/` — the authenticated app shell (role-aware nav in
  `layout.tsx`) and all feature pages.

## Commands

```bash
npm run dev          # start the app (http://localhost:3000)
npm run db:migrate   # create/apply a migration after editing schema.prisma
npm run db:seed      # (re)seed demo data — safe to re-run, upserts
npm run db:studio    # Prisma Studio (visual DB browser)
npm run db:reset     # drop + recreate + reseed the dev database
```
