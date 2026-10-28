# Technical & Product Decisions

Material decisions made while building this app, in addition to the Decision
Log tab (16 Decisions) in the HR App Build Guide. Newest first.

## 2026-10-08 — ATT-1: approved leave shows on the attendance grid and the payroll Excel (workflow gap review)

Before: approving a leave request removed the days from the "unresolved days"
queue but never reached the attendance grid, so the grid and the payroll Excel
(built from the same grid) showed no leave code and 0 hours for those days
until Admin SDM classified each day by hand.

Now (option chosen by the owner: the grid reads approved leave directly, nothing
extra is stored): `getReconciliationGrid` loads the approved requests and, for
each day, uses the request's leave type when ALL of these hold
(`src/lib/leave-on-grid.ts`):
- Admin SDM has not made an explicit call for the day (no absence code
  classified, no "Masuk (Lupa Absen)"); what Admin SDM enters always wins, the
  same precedence the mandays-lost report uses;
- the person did not punch both in and out that day;
- it is a working day for them (not a day off, not a public holiday).
The day then gets the leave type's code, points and paid-hours multiplier
exactly as if Admin SDM had classified it, and the cell tooltip says it comes
from an approved request. If the leave is later cancelled or overridden to
Ditolak, the grid follows by itself.
- **Hours:** with no punch to say which schedule applies, a leave day is paid on
  the shift the person is rostered for that week (weekly shift assignment,
  Shift 1 when none), unless a shift was entered for that day. This is a
  deliberate exception to the older "category without a shift does not count"
  rule, which was written for days Admin SDM classifies by hand.
- Days up to today are shown, as before; future leave appears when its day
  arrives.

## 2026-10-08 — EMP-1: a future-dated move no longer leaves a gap (workflow gap review)

Before: the direct move, executing a Movement request and the placement import
all marked the old primary placement ENDED immediately, even when the move was
dated in the future. Authority (HR Manager / Dept Head), the org-chart seat and
the renewal scan only count placements that are ACTIVE and inside their dates,
so until the effective date the employee had no active primary placement, while
`currentPositionId` already pointed at the new seat.

Now: when a move REPLACES a current primary placement and its date is after
today (WIB), the old placement stays ACTIVE and only gets its end date, and the
new placement is stored with the new status **SCHEDULED** (additive migration
`20261008050000_assignment_scheduled`). Everything that decides authority reads
the dates (`activeAssignmentWhere` now accepts ACTIVE and SCHEDULED, the date
clause keeps a scheduled row out until its start), so the switch happens at
midnight on the effective date. The nightly job (`applyDuePlacementChanges`)
then makes the stored data catch up: the new placement becomes ACTIVE, the old
one ENDED, `currentPositionId` and the seats' Kosong/Terisi follow.
- A move dated today or earlier works exactly as before. A FIRST placement
  (nobody to replace) is never scheduled; its own start date already decides.
- A scheduled move reserves its seat (`isPositionOccupiedByPrimary`, vacant-seat
  list and "archive position" all count SCHEDULED), so nobody else can be put
  there first.
- One scheduled move per employee: a second direct move, transfer request or
  import row is refused until the first has taken effect or been cancelled.
- Admin SDM can call off a scheduled move on the Penempatan tab ("Batalkan
  jadwal"): the old placement goes back to open-ended and the scheduled row is
  closed as an empty period (history kept).
- If the employee leaves before the date, Exit Clearance closes the scheduled
  placement too.

## 2026-10-08 — Onboarding, transfers, offboarding and leave decisions (workflow gap review)

**Onboarding**
- **ONB-1.** When a new hire is FIRST placed in a position (direct move on the
  employee page, or the placement import), the onboarding courses that depend
  on the position (position, job, department rules) are assigned then
  (`src/lib/onboarding-placement.ts`). Only for someone with an open onboarding
  case, so imported staff never receive onboarding courses. The "Materi Wajib"
  item no longer shows as done for an employee with no placement: it says
  "Menunggu penempatan", and for a placed employee with nothing assigned it says
  no mandatory material applies to the position.
- **ONB-3.** An onboarding case can be cancelled with a reason (no-show, hired by
  mistake, left during onboarding) and reopened. New status "Dibatalkan"
  (additive migration `20261008040000_onboarding_cancel`). Admin SDM can edit
  the planned start date, and it follows the employee's Tanggal Bergabung when
  that is corrected (open cases only).

**Transfers (Perubahan Posisi)**
- **MOV-1.** One open request (Menunggu Kepala Dept, Diajukan or Disetujui) per
  employee; a second is refused with the number of the open one. At the HR
  Manager's approval the request is also refused if the placement it was meant
  to change is no longer active.
- **MOV-2.** Left as is: Promosi and Mutasi will get a separate document, so an
  ordinary move still does not update the contract.

**Offboarding**
- **OFF-2.** The employee keeps their placements and login through the whole
  last working day. Exit Clearance done before the day is over only completes
  the case; the nightly job (`runOffboardingDeactivations`) then ends the
  placements, marks the employee inactive and disables the login. Clearance
  done after the last day deactivates immediately, as before. A case still
  waiting for clearance after its last day has the LOGIN disabled by the nightly
  job (the employee record stays until clearance, so asset accountability is
  kept); if that case is later cancelled, the login is re-enabled by hand from
  the employee page.
- **OFF-3.** A cancelled non-renewal offboarding can be started again from the
  renewal case (the cancelled case is reopened, since a renewal case links to
  exactly one offboarding case). Starting any offboarding is refused while the
  employee already has an open one.
- **OFF-4.** At asset clearance the return condition is Baik / Perlu perbaikan /
  Rusak berat / Hilang. Rusak berat and Hilang no longer mark the asset
  disposed on the spot: the asset goes to Under Repair (beyond repair) or Lost
  Pending Review (lost) and a disposal proposal (Draft) is created, which goes
  through the normal approval. Quantity-tracked items get no disposal case. The
  single-asset return screen in the Assets module still has the old shortcut
  (not part of this decision).

**Leave and attendance**
- **ATT-4.** Leave uses only working days: weekends, the employee's days off and
  public holidays are not counted against quota. The request page and the
  dashboard list show "N hari kerja" (`src/lib/leave-days.ts`).
- **ATT-5.** A day is counted once in the quota even when it is both inside an
  approved request and classified by HR with the same type.
- **ATT-6.** Public holidays, Tanggal Merah AND Cuti Bersama, are not lost
  mandays (also inside an approved leave) and not part of the scheduled days in
  the % denominator. This only has effect once holidays are entered in the
  holiday calendar (it was empty on 2026-10-08).
- **ATT-8, ATT-9, ATT-10.** Left as they are: no employee punch-correction
  request, no overtime process, and employees without an attendance method are
  not chased by the nightly job.

## 2026-10-08 — Recruitment workflow decisions (from the workflow gap review)

1. **REC-1, Dept Head stage can't be skipped.** The requester is always the
   logged-in employee; the requester id sent by the form is ignored unless
   the logged-in user is Admin SDM (who may file on someone's behalf). The
   Dept Head stage is skipped only when the person actually submitting is the
   Dept Head of that department. Admin SDM filing for a Dept Head still sends
   it to that Dept Head. (The Dept Head can still approve a request filed in
   their own name; the general self-approval question is gap X-2.)
2. **REC-2, any seat under the department can be filled.** A request names a
   Department, and a seat belongs to it when it sits in that Department or
   anywhere below it (Section, Group, Team). Before this, only seats placed
   directly on the Department could be used: 14 of 185 positions. The
   "Buat Karyawan" picker now lists only VACANT seats of the approved job
   (`src/lib/recruitment-seats.ts`), labelled with their unit, and the action
   also refuses archived seats.
3. **REC-3, "Tutup" and a vacancy heads-up.**
   - A partly filled request can be closed (status CLOSED, reason required,
     by Admin SDM or the active HR Manager); hires already made stay linked.
     A request with no hires is cancelled instead. Stored in the new columns
     `closedAt`, `closedByAccountId`, `closeReason` (additive migration
     `20261008030000_recruitment_close_reason`).
   - When the HR Manager picks the Jabatan at approval, the form shows how
     many vacant seats that job has in the department against the headcount
     asked for. It is a warning only; approval is never blocked, since the
     seats may be added afterwards.
   - A returned request (Kembalikan) can be edited and resubmitted by its
     requester or Admin SDM ("Ubah & Ajukan Ulang"). It returns to the stage
     that sent it back (Dept Head or HR Manager); if the department was
     changed it restarts at the new department's Dept Head. The old return
     note is cleared from the request and kept in the audit log.

## 2026-10-08 — Org structure workflow decisions (from the workflow gap review)

The owner went through the Org structure gaps in the workflow review
(artifact "CBP HRIS Workflow Map") and decided:

1. **Position status is only Kosong (VACANT) or Terisi (FILLED)**, always
   derived from active placements. Planned is not needed. The status field
   is gone from the edit form and from the position import (an old file
   with a `positionStatus` column is still accepted; the column is ignored).
   `syncPositionStatus` now overwrites any leftover value. PLANNED/FROZEN/
   CLOSED stay in the database enum only because enum values are never
   dropped from the shared production database. At the time, all 185
   production positions were FILLED, so no data needed converting.
2. **A seat that is no longer needed is archived straight away**: no
   Dibekukan/Ditutup step. Archiving still requires no active placement and
   no (non-archived) position reporting to it; it also clears the HR
   Manager flag. This supersedes the "Ditutup first, then archive" rule.
3. **ORG-1, position import**: a blank `reportsToPositionCode` now leaves an
   existing position's line manager unchanged (new position: no manager);
   `KOSONGKAN` removes it. A row whose manager is a new position in the
   same file is held back if that position's row is rejected, and a manager
   created further down the file gets a "move that row up" message instead
   of "not found". Rules live in `src/lib/import-export/position-rules.ts`
   (unit-tested).
4. **ORG-3, vacancies**: kept as is. A vacancy does not create anything;
   hiring always goes through Permintaan Tenaga Kerja.
5. **ORG-5, HR Manager access**: only ONE position may carry
   `grantsHrManagerAccess`. The create/edit form refuses a second one and
   names the current holder; the import rejects a "Ya" row unless the
   current holder is set to "Tidak" in the same file, and rejects every
   "Ya" row when a file has more than one. At the time no production
   position had the flag, so nobody had HR Manager authority yet.
6. **ORG-4, structure warnings**: kept as is (warnings on the org chart,
   not blocks).

## 2026-08-18 (UAT prep) — Removed Employee.preferredName; fullLegalName everywhere

Resumed a task paused on 2026-08-06 (see that date's memory note) — the
user's original instruction was "always use employee full name delete
proffered name field," paused mid-task with the schema safely reverted.
Triggered again today by a concrete symptom during UAT prep: SUHARTONO's
account greeted him as "UAT-0107" on the dashboard instead of his name,
because `auth.ts`'s session-name computation preferred
`account.employee?.preferredName` over `fullLegalName`, and his
`preferredName` was a leftover synthetic placeholder from the real-data
migration's UAT seed pass. Direct user instruction: "change it with full
name for everything, no preferred name needed... these users will be
easily testing it as they are familiar with all of the people."

**Scope, full removal this time, not just display**: `Employee.preferredName`
dropped from `prisma/schema.prisma` entirely (migration
`20260818095740_remove_employee_preferred_name`, standard SQLite
RedefineTables rebuild, generated via `prisma migrate diff` since
`migrate dev`'s confirmation prompt can't run non-interactively — reviewed
the generated SQL before applying). ~92 references across ~45 files fixed
in two passes:
1. Mechanical regex pass for the `X.preferredName ?? X.fullLegalName`
   display-coalescing pattern (62 replacements) — a backreference-based
   regex matched the identical object-path prefix on both sides of the
   `??`, so it correctly left any further `?? ...` fallbacks in the same
   expression untouched (e.g. `cancelledByEmployee?.preferredName ??
   cancelledByEmployee?.fullLegalName ?? cancelledByAccount?.usernameOrEmail`
   correctly became just the first two operands collapsed).
2. A second regex pass for the structural leftovers — `preferredName: true`
   in Prisma `select` clauses and `preferredName: string | null` in TS
   type literals (30 replacements).
Then ten files needed hand edits: the Employee list search `OR` clause,
the Recruitment "create Employee from approved request" form + action, the
`auth.ts` session-name fallback chain (the actual bug), the i18n label +
its one remaining `<Field>` usage, the bulk import/export dataset column
mapping, a `permissions.test.ts` mock, and three `prisma/seed.ts` demo
records.

**Live-verified**: logged in as `depthead.production@cbp.demo` (SUHARTONO)
post-migration — dashboard now reads "Beranda — SUHARTONO". Confirmed the
Employee list search-by-name and the Approvals inbox (which shows several
other employees' names) still render correctly. Full suite (301 tests),
`tsc --noEmit`, and `eslint` all clean.

**Non-interactive migration workaround, worth remembering**: `prisma
migrate dev` (with or without `--create-only`) refuses to run when a
migration has a data-loss warning and the environment is non-interactive —
even just to generate the SQL file. Workaround: create the migration
folder by hand, then `prisma migrate diff --from-migrations
./prisma/migrations --to-schema ./prisma/schema.prisma --script` to
generate the SQL non-interactively (review it before saving), then `prisma
migrate deploy` to apply. Note the flag is `--to-schema`, not
`--to-schema-datamodel` (renamed in this Prisma version).

## 2026-08-18 (later same day) — Training Admin becomes sole owner of Training & Competency

Direct user request, made right after reviewing the access matrix built
earlier the same day ("Make Training Admin the operational owner. HR Admin
have no access"). Withdrew every `isHrAdmin` fallback across the whole
Training & Competency domain, mirroring the wall-off shape GA Admin already
had over Assets/GA (see Phase 4B's decision entry below) — HR Admin's usual
"can administer anything" latitude does not apply here, same as it already
didn't apply to GA/Asset operations.

**Scope**: every predicate in `permissions.ts` for Competency Framework/
Cycle, Competency Assessment scoring & reassignment, the historical
migration, Competency Gaps reporting, Training Requests (submit/decide/
cancel), Training Courses, Mandatory Training Rules, Learning Assignments,
company-wide LMS reporting, Learning Effectiveness tasks, and the two
training-domain Import datasets. Also the Onboarding "training complete"
flag (`canMarkOnboardingTraining`) — the one completion flag on that page
that isn't HR Admin's to mark alongside its owner, since Training is now
fully Training Admin's. The Onboarding module itself, the "contract
complete" flag, and Employee Master visibility were **not** touched — those
remain HR Admin's as before; this was scoped to Training & Competency only.

**Two capabilities that move to Training Admin rather than disappear**:
P1/P2 evaluator reassignment (`canReassignCompetencyEvaluator`) and running
the one-time historical competency migration
(`canRunCompetencyHistoricalMigration`) were both HR-Admin-exclusive before
today, deliberately separated from Training Admin's operational latitude
("HR Admin may reassign but cannot score", "HR Admin alone may run the
migration; Training Admin may only review after commit"). Both authorities
now sit with Training Admin instead — full ownership transfer, not a
carve-out.

**Cancellation now matches the GA Requests shape exactly**:
`canCancelTrainingRequest` was `{requester} ∪ {Training Admin} ∪ {HR
Admin}`; it's now `{requester} ∪ {Training Admin}`, identical in shape to
GA Requests' `{requester} ∪ {GA Admin}` — the first precedent in this app
for a domain with genuinely no HR Admin fallback at any stage, now applied
a second time.

**Nav-gate consequence**: `layout.tsx`'s "broad nav, scoped page" pattern
meant most of these nav items were already visible to any employee-linked
account regardless of HR Admin — removing HR Admin's OR-branch there mainly
affects the HR Admin account itself (which has no `employeeId`), so it now
loses every Training & Competency nav entry outright rather than falling
back to a narrower view.

**Tests**: updated 12 assertions in `permissions.test.ts` that encoded the
old HR-Admin-inclusive behavior (301 → still 301, since these were edits to
existing tests, not new ones). Full suite, `tsc --noEmit`, and `eslint` all
clean.

## 2026-08-18 — Link GA Operations to Onboarding and Offboarding

Direct user request ("Link assets to on boarding and off boarding"), asked
right after Phase 4B shipped. Since Phase 4A's `AssetCustody` was already
fully linked to both flows (derived onboarding checklist item, offboarding
clearance blocker), this was clarified via `AskUserQuestion` into two
concrete, independent asks:

**Onboarding — GA Admin can assign equipment directly from the case.** A
new `AssignAssetToOnboardingForm` on the Onboarding detail page lets GA
Admin pick an AVAILABLE asset and hand it to the employee without leaving
the page. Implemented as a thin wrapper,
`assignAssetDuringOnboarding` (`onboarding/actions.ts`), that calls the
real, unmodified `assignAssetToEmployee` (Phase 4A, `assets/actions.ts`)
and additionally revalidates the onboarding case's own path — genuine
reuse, not reimplementation, same pattern as Phase 4B's own Phase 4A
handoff.

**Offboarding — exit clearance also blocks on unresolved Damage/Loss GA
requests.** New pure predicate `blocksOffboardingGaRequest(requestType,
status)` in `lib/ga-operations.ts`: a request blocks only while it's
still short of its own terminal status (`WORK_ORDER_CREATED` for damage,
`LOSS_CONFIRMED`/`LOSS_NOT_CONFIRMED` for loss) — `NEW_ASSET_NEED` never
blocks, since an unfulfilled equipment request isn't an accountability
issue and can simply lapse. Wired into `executeExitClearance`
(`offboarding/actions.ts`) alongside the existing custody blocker, with a
combined error message when both fire, and surfaced identically on the
Offboarding detail page. Deliberately does **not** re-check
`AssetCustody` for these requests — for a Damage/Loss report on the
employee's own asset, custody is untouched by the GA workflow (nothing in
Phase 4B closes a custody row), so the existing custody blocker already
covers that case; this new check's real value is catching a report about
an asset that isn't (or is no longer) in the employee's own custody.

**Live-verified**: assigned AST-CHAIR-POOL to EMP-0002 from
`/onboarding/[id]` — second custody row appeared immediately, no
navigation away. Submitted a fresh `DAMAGE_OR_ABNORMAL_CONDITION` request
as `level1.production@cbp.demo` (EMP-0001, who has a real
`PENDING_CLEARANCE` case), confirmed exit clearance was blocked
server-side with the exact new message, then verified the request (GA
Admin) to `WORK_ORDER_CREATED` and confirmed the blocker panel
disappeared. Full suite (301 tests, +3), `tsc --noEmit`, and `eslint` all
clean. Hit one unrelated dev-server crash mid-session ("Jest worker
encountered 2 child process exceptions") — fixed with the usual kill +
clear `.next` + restart, not a code issue.

**Follow-on same day — GA Admin couldn't see who's offboarding.** User
noticed GA Admin's nav had no Offboarding entry ("I don't see off
boarding menu in GA") — expected/correct, since `/offboarding`'s gate
(`isHrAdmin(session) || session.user.employeeId`) never admits an
employee-less GA Admin account, matching the Phase 4A boundary that keeps
GA Admin out of HR-only data. But the new GA-request blocker made this a
real gap: GA Admin had no way to know which employees to proactively
clear. Clarified via `AskUserQuestion`
("I want them to confirm that all assets have been return but for that
they need to know how [who] need to be off boarding") into a narrow,
purpose-built page rather than widening `canViewOffboardingCase` or the
real Offboarding pages — `/offboarding/asset-clearance`
(`offboarding/asset-clearance/page.tsx`, gated on `canManageAssets`)
lists only employees with an active case, their case number/status, and
their open custody/GA-request items — never the reason, Dept
Head/HR Manager decisions, or clearance notes, which stay HR-only. New
"Klirens Aset Offboarding" nav entry, GA-Admin-only. Live-verified as
`ga.admin@cbp.demo` in a fresh browser tab (an unrelated stale-session
artifact from Fast-Refresh churn made two earlier login attempts in the
same tab appear to fail even though the first had actually succeeded
server-side — a new tab sidestepped it cleanly): page renders
OFB-2026-0001 (UAT-0001) as "Aset Selesai", and the nav item is present
for GA Admin and absent for HR Admin.

## 2026-08-14 (later same day) — Phase 4B: GA Operations

Built from `Phase_4B_GA_Operations_Workflow.pdf` (2 pages: "Requests,
incidents and routing" / "Maintenance and disposal"), on top of the
accepted Phase 0–4A build without modifying any of it — Operational
Vehicle Usage explicitly excluded per the request. Proceeded autonomously
on the detailed spec (same precedent as Phase 4A), flagging assumptions
below rather than asking mid-build.

**Schema** (5 new models, 11 new enums, 2 additive `AssetStatus` values,
3 migrations): `GaRequest` (New Asset Need / Damage-Abnormal-Condition /
Loss, one shared status enum gated by type in `lib/ga-operations.ts`, not
the schema), `GaApprovalConfig` (Position-per-approval-type, mirrors
`AbsenceEntitlementConfig`'s shape — global, not department-scoped, since
the PDF gives no department signal for GA approvals), `MaintenancePlan`
(preventive, due-date-driven), `MaintenanceWorkOrder`
(preventive/corrective, internal/vendor), `DisposalCase`
(Beyond-Repair/Obsolete/Confirmed-Loss → Position-approved →
executed). `AssetStatus` gained `LOST_PENDING_REVIEW` and `RETIRED` —
zero code changes needed to satisfy "cannot be newly assigned" for either,
since Phase 4A's `isAssetAvailableForIndividualAssignment` is already an
`AVAILABLE`-only allowlist. `RETIRED` is deliberately a new, separate
terminal status from Phase 4A's existing `DISPOSED` (the informal
return-inspection shortcut) — Phase 4B's formal, Position-approved
execution never reuses it. Cross-links between a `GaRequest` and what it
produced (`resultingCustodyId`, `sourceWorkOrderId`, `sourceGaRequestId`)
are plain unconstrained `String?` columns, not Prisma relations — same
convention `AssetCustody.transferredToCustodyId` already uses in this
schema, chosen to avoid a web of back-relation bookkeeping for what are
purely informational pointers. `GaRequestStatus` also got a `CANCELLED`
value (schema/migration `20260814020000_ga_request_cancellation`,
additive) for the same DM-25-style withdrawal every other
submittable-request workflow in this app already has — the PDF doesn't
show it explicitly but omitting it would have been the one workflow in
the whole app without a cancel path.

**Pure logic** (`lib/ga-operations.ts`, 22 unit tests): numbering,
status-transition/routing gates per request type, and the asset-status
side effects of each transition (verification moves a
damage/loss-reported asset to `UNDER_REPAIR`/`LOST_PENDING_REVIEW`;
maintenance `OPERATIONAL` returns it to `IN_USE`/`AVAILABLE` depending on
whether custody is still open; `BEYOND_REPAIR` leaves it blocked pending
disposal; disposal execution always ends at `RETIRED`).

**Approvals**: one shared session-based predicate,
`canDecideAsConfiguredGaApprover(actingEmployeeId, holderIds)`, reused for
all three GA approval points (New Asset Need, Loss Review, Disposal) —
the caller resolves the live holder set from `GaApprovalConfig` via the
existing `getCurrentHolderEmployeeIds`. New Asset Need is the only
approval point that can be configured *absent* (request auto-progresses,
matching the PDF's dashed "Approval required? No" line); Loss Review and
Disposal sitting unconfigured just means no one can currently decide them
— same convention as every other unconfigured-Position gap already in
this app.

**Real bug caught during live verification, fixed same session**:
`canViewGaRequest`'s approver-widening was originally keyed off the
request's *current status* (`PENDING_APPROVAL`/`PENDING_LOSS_REVIEW`) —
so the moment an approver decided a request, the status moved past that
window and the page denied the very person who just acted on it (hit live
as `level3.production@cbp.demo` immediately after approving
GAR-DEMO-0001: "Anda tidak memiliki akses ke halaman ini"). Fixed by
keying the widening off `requestType` instead (stable for the record's
whole life — NEW_ASSET_NEED always maps to the NEW_ASSET_NEED config,
LOSS always to LOSS_REVIEW), re-verified working.

**Reuse-via-direct-invocation for the Phase 4A handoff**: an approved New
Asset Need request's "allocate available asset" path calls the existing,
unmodified `assignAssetToEmployee`/`ToDepartment`/`ToLocation` actions in
`assets/actions.ts` with a constructed `FormData`, then looks up the
just-created `AssetCustody` row (most recent for that asset) since those
actions don't return an id — genuine reuse, not reimplementation, and the
one honest way to avoid touching accepted Phase 4A code for this.

**Access boundary**: `canManageGaOperations` (GA Admin only) gates every
mutation across GA requests, maintenance and disposal — HR Admin gets
zero nav entries and every direct URL hit returns the standard access-
denied page, live-verified as `hr.admin@cbp.demo` against all four
GA-only pages. `canSubmitGaRequest`/`canViewGaRequest` are broader (any
employee-linked account may submit and see their own), matching
"Requester sees only own requests."

**Documented assumptions**: (1) the PDF's `OBSOLETE` disposal reason has
no dedicated flow producing it, unlike `BEYOND_REPAIR`
(maintenance outcome) or `CONFIRMED_LOSS` (loss review) — built as a
direct manual GA Admin trigger on any non-retired asset
(`createObsoleteDisposalCase`, exposed on the asset detail page). (2)
`MaintenancePlan.intervalDays`/`intervalKm` are descriptive/manually-
referenced fields, not an automatic interval-rollover engine — GA Admin
enters the plan's next due date by hand when executing a work order,
same "due" detection pattern (derive-on-read from `dueDate`) as every
other due-date check in this app. (3) "Allocate available asset" lets GA
Admin pick any target (employee/department/location), defaulting the UI
to the requester for the common case but not restricting to it — the PDF
doesn't say the new asset must go to the original requester.

**Migrations**: `20260814010000_phase4b_ga_operations` (5 new tables,
purely additive), `20260814020000_ga_request_cancellation` (adds
`CANCELLED` + cancellation fields to `GaRequest`, one SQLite table
recreation, zero data loss — table was empty at the time).

**Seed**: `scripts/seed-phase4b-ga-operations.ts` configures all three
`GaApprovalConfig` rows to "Asst Manager Production" (RISWANTO,
`level3.production@cbp.demo` — a real, already-login-capable Position,
reused rather than inventing a new demo login) and leaves four open GA
requests plus one due `MaintenancePlan` and one already-`UNDER_REPAIR`
asset with an open preventive work order, so every acceptance checkpoint
is reachable with minimal further clicks.

**Live-verified, full walkthrough**: NEW_ASSET_NEED approved → Phase 4A
custody handoff (asset went `IN_USE`, custody row created); a second
NEW_ASSET_NEED rejected; DAMAGE_OR_ABNORMAL_CONDITION → corrective work
order → executed `OPERATIONAL` (asset returned to `IN_USE`); preventive
`MaintenancePlan` → work order created live from the plan → executed
`OPERATIONAL` (plan's `dueDate` rolled forward, overdue badge cleared);
a separate preventive work order executed `BEYOND_REPAIR` → auto-drafted
`DisposalCase` → submitted → approved by the configured Position →
executed (`SELL_AS_SCRAP`, asset `RETIRED`) — evidence upload for this
step done via a throwaway `tsx` script calling the same code path
directly, since `<input type="file">` still can't be driven through this
browser tool (same documented Phase 4A limitation); LOSS request
confirmed by the configured reviewer → asset `LOST_PENDING_REVIEW` →
second `DisposalCase` auto-drafted (`CONFIRMED_LOSS`); HR Admin denied on
all four GA pages; a `RETIRED` asset's assignment confirmed rejected by
`createCustody`'s existing status guard. Full suite (298 tests),
`tsc --noEmit`, `eslint`, and `next build` all clean throughout.

## 2026-08-14 (later same day) — Remove asset acknowledgement gate

Direct user feedback: "aset tidak butuh Menunggu Konfirmasi Penerimaan"
("assets don't need [the] Waiting for Acknowledgement [status]"), given
right after trying the assign-to-employee flow themselves — a stray
`AssetCustody` row sitting in `PENDING_ACKNOWLEDGEMENT` on a real employee
confirmed this was hit live, not hypothetical. This overrides the PDF's
own "Employee acknowledges receipt → custody becomes Active" step, which
the user judged unnecessary friction: GA Admin recording the handover
(condition, evidence) at assignment time is sufficient, no separate
employee confirmation click is needed.

**Schema**: `AssetCustodyStatus` reduced from 3 values to 2
(`ACTIVE`/`RETURNED` — `PENDING_ACKNOWLEDGEMENT` removed entirely); the
now-meaningless `AssetCustody.acknowledgedAt` field dropped too. Migration
`20260814000000_remove_asset_acknowledgement` does a data fix-up first
(promotes any existing `PENDING_ACKNOWLEDGEMENT` row to `ACTIVE`, which
caught exactly one real row from the user's own click-through) before the
SQLite table-recreation that drops the column.

**Code**: `initialCustodyStatus()` removed from `lib/assets.ts` — every
custody target type (Employee/Department/Location) now starts `ACTIVE`
directly in `createCustody`/`transferAssetCustody`
(`src/app/(app)/assets/actions.ts`). `acknowledgeAssetCustody` action and
its permission predicate (`canAcknowledgeAssetCustody`) deleted outright —
no caller remains. `/my-assets`'s pending-acknowledgement notice/button
removed (`AcknowledgeButton` component deleted).

**Consequence for the earlier "Perlengkapan Selesai" derivation** (see the
entry above, from earlier the same day): `isOnboardingAssetsComplete` is
kept as a real predicate (correctness against `RETURNED`-filtered,
all-`ACTIVE` custody), but since `AssetCustodyStatus` no longer has any
value between "just assigned" and "returned," it now evaluates true the
instant GA Admin assigns anything — there is no window where it can be
false in practice anymore. This is accepted as a natural consequence of
removing the acknowledgement step, not a bug — flagged here rather than
silently left implicit.

**Live-verified**: assigned a fresh asset to a real employee through the
UI → custody row showed `Aktif` immediately, no pending state, no
acknowledge button anywhere. Full suite (276 tests), `tsc --noEmit`,
`eslint`, and `next build` all clean.

## 2026-08-14 — Onboarding × Assets: fully derive "Perlengkapan Selesai"

Direct user feedback right after the Phase 4A entry below: "assets is not
link to on boarding yet." Correct — the Phase 4A build had deliberately
left `OnboardingCase.assetsComplete` as a manual GA-Admin toggle (justified
at the time by "no `isOnboardingRequired`-equivalent concept exists for
assets"), with a real custody list rendered next to it only for context.
That reasoning didn't hold up: the PDF's own workflow text — "Employee
acknowledges receipt → Employee custody becomes Active → HR Admin sees
requirement Completed" — describes exactly the same live-derivation the
app had already built for training completion one step earlier in the same
session. Fixed to match: added `isOnboardingAssetsComplete(assetCustodyStatuses)`
to `src/lib/onboarding.ts` (RETURNED custodies are closed history and don't
block; zero assets assigned is trivially complete; any open
`PENDING_ACKNOWLEDGEMENT` custody blocks — same three-way shape as
`isOnboardingTrainingComplete`). Removed `OnboardingCase.assetsComplete`/
`assetsCompletedAt`/`assetsCompletedByAccountId` from the schema entirely
(migration `20260813000000_derive_onboarding_assets_complete`, SQLite
table-recreation; verified all rows had `assetsComplete=false` pre-migration
— zero data loss) along with the now-dead `AssetsToggle` component and
`canMarkOnboardingAssets` permission predicate (its only caller). The
detail page's asset block now matches the training block exactly: no
manual toggle, no GA-Admin visibility gate (anyone who can view the case
sees the same real custody list), just a live ✓/— derived from
`AssetCustody` rows. `toggleContractComplete` (the one flag that's still
genuinely manual — no "contract complete" signal exists anywhere else)
now fetches both training and asset status live to recompute
`completedAt` correctly. Live-verified end to end: assigned an
unacknowledged asset to a case with no prior assets → "Perlengkapan
Selesai" flipped from ✓ to — showing the pending asset → acknowledged it
→ flipped back to ✓ automatically, both on the detail page and the
list page's batch-derived status column.

## 2026-08-13 — Onboarding-Training auto-assign + Phase 4A: Employee Assets

### Onboarding × Training integration (small follow-on to Phase 3B)

Per direct user request ("some compulsory course will be use for on
boarding"), clarified via 3 questions (all "Recommended" answers accepted):
`TrainingCourse.isOnboardingRequired` (new checkbox) marks a published
course as part of new-hire onboarding; `createEmployee`/
`createEmployeeFromRecruitmentRequest` both call
`applyOnboardingMandatoryTrainingForEmployee` right after the employee
record commits, auto-assigning every active onboarding-required Mandatory
Training rule the new hire's audience resolves into (only EVERYONE/EMPLOYEE
target types resolve on the `createEmployee` path, since no
`currentPositionId` is set there yet; all target types resolve on the
recruitment-fulfillment path). `OnboardingCase.mandatoryMaterialComplete`
(the old manually-toggled flag) was removed from the schema entirely —
"Materi Wajib" is now derived live every time the case detail/list page
renders, via `isOnboardingTrainingComplete(assignmentStatuses)`, the same
derive-on-read pattern as `ContractRenewalCase`'s D-30 trigger. Migration:
`20260812010000_add_onboarding_training_link` (SQLite table-recreation for
`OnboardingCase`/`TrainingCourse`; verified 0 of 2 pre-migration rows had
the removed flag set — zero data loss).

### Phase 4A: Employee Assets

Built from `Phase_4A_Employee_Asset_Workflow.pdf`'s 2-page swimlane diagram
(create/assign/acknowledge → movement/return/offboarding-block), additive
against every prior phase. New `GA_ADMIN` role workspace, deliberately
**excluding** HR Admin from every asset-mutation predicate
(`canManageAssets`/`canViewAssetMaster`/`canImportAssetMaster`) — the one
explicit access-boundary deviation from this app's usual
"`isHrAdmin(session) || isXAdmin(session)`" pattern, per the PDF's literal
"HR Admin receives only onboarding/offboarding completion or blocker
status and cannot create, assign, return or edit GA records."

**Schema** (`20260812020000_add_phase_4a_employee_assets`, purely additive —
3 `CREATE TABLE`, zero `ALTER`/`DROP`): `AssetLocation` (new minimal
GA-managed master data, no existing "Location" concept fit —
`AttendanceGeofence` is GPS-purpose-built, not a generic location);
`FixedAsset` with `AssetTrackingType` (INDIVIDUAL/QUANTITY_TRACKED) —
Individual assets are single-unit, `status` is authoritative and flips to
IN_USE the instant ANY custody exists (even pending acknowledgement) to
close the double-booking window; Quantity-tracked assets pool
`totalQuantity`/`availableQuantity`, `status` stays AVAILABLE by
convention, and a non-GOOD return does NOT rejoin the pool (documented
Phase-4B-deferred simplification — repair/disposal workflows are explicitly
out of scope per the PDF's own phase boundary language); `AssetCustody`
models the tri-target invariant (`targetType` discriminator + 3 nullable
FKs — same pattern as `MandatoryTrainingRule`'s existing target-type
design, since Prisma/SQLite has no polymorphic association) with
`PENDING_ACKNOWLEDGEMENT`→`ACTIVE`→`RETURNED` status (only an
EMPLOYEE-target custody needs acknowledgement; DEPARTMENT/LOCATION starts
ACTIVE immediately) and `transferredToCustodyId` linking an atomic
return-and-reassign to its replacement row, so history is never
overwritten and an INDIVIDUAL asset never passes back through Available
mid-transfer.

**The one load-bearing rule** — "Only open Employee custody blocks
offboarding" — is now a real DB-backed check in `executeExitClearance`
(`src/app/(app)/offboarding/actions.ts`), replacing a stale, purely
cosmetic warning string (`offboarding.clearanceAssetNotice`) that had
existed since before Assets was modeled at all. Confirmed live: assigned
`AST-LAPTOP-001` to EMP-0001 (who already had a real `PENDING_CLEARANCE`
Offboarding Case in this dataset), attempted exit clearance → server
rejected with the specific asset named in the error, returned the asset as
GA Admin, re-checked the case → blocker panel gone, button enabled, no
error. Deliberately did **not** click through to actually complete that
real employee's exit clearance (irreversible account-disable + assignment-
end on the live 200-employee dataset) — the blocker's removal alone proves
the rule.

**Reused unmodified**: `FileObject`/`/api/files/[id]` category-widening
pattern (added `ASSET_HANDOVER_EVIDENCE`/`ASSET_RETURN_EVIDENCE`, gated
GA-Admin-or-self); the generic `ImportBatch`/`ImportRow`/`DatasetModule`
registry (added `asset-master` — catalog fields only; `trackingType`/
`totalQuantity` are CREATE-only via import, never touched on UPDATE, since
an existing asset can already have custody history an import row has no
safe way to reconcile — "Asset Master may be imported; operational
transactions are completed in-app" per the PDF); `AuditLog`/`logAudit()`;
private-file storage.

**Onboarding/Offboarding folded in**: onboarding detail page shows a
GA-Admin-visible real custody list next to the existing (still manual,
GA-Admin-only) `assetsComplete` toggle — full derivation was skipped
because, unlike training, there's no "required for onboarding" concept on
`FixedAsset` yet. Offboarding detail page renders the same real open-custody
list as an amber blocker panel whenever one exists.

Seeded UAT data (`scripts/seed-phase4a-assets.ts`, one-time, safe to
re-run): 3 locations, 5 assets spanning both tracking types and all three
custody target types, deliberately leaving EMP-0001 untouched so the live
demo walkthrough had a real employee to assign to. Live-verified the full
requested scenario end to end via browser: import (CSV upload isn't
scriptable through browser automation — verified instead by driving the
same `dryRun`/`commitRow` functions the upload form calls) → assign to
employee → acknowledge (as the employee) → offboarding blocked (as HR
Admin) → return (as GA Admin) → offboarding continues. Also re-verified
Phase 3A (`/training/mandatory-rules`, previously hit by a stale-dev-server
false alarm) and the onboarding-training auto-derive still work correctly
against the live dataset.

**Files changed**: `prisma/schema.prisma` + 2 migrations; `src/lib/assets.ts`
(new, pure, tested); `src/lib/onboarding.ts`, `src/lib/mandatory-training.ts`
(onboarding-training helpers); `src/lib/permissions.ts` (narrowed
`canMarkOnboardingAssets`, widened `canAccessImport`, new Phase 4A block);
`src/app/(app)/employees/actions.ts`, `src/app/(app)/recruitment/actions.ts`
(auto-assign wiring); `src/app/(app)/training/courses/*`
(`isOnboardingRequired`); `src/app/(app)/onboarding/*` (removed manual
training toggle, added real custody list); `src/app/(app)/offboarding/
actions.ts` + `[id]/page.tsx` + `[id]/decision-forms.tsx` (real blocker);
`src/app/(app)/assets/**`, `src/app/(app)/my-assets/**` (new UI, all pages);
`src/lib/import-export/asset-master.ts` + `registry.ts` (new dataset);
`src/app/api/assets/export/route.ts` (new); `src/app/api/import-export/**`,
`src/app/(app)/import/**` (asset-master wiring); `src/app/api/files/[id]/
route.ts` (evidence category widening); `src/app/(app)/dashboard/page.tsx`
(GA stat cards); `src/app/(app)/layout.tsx` + `src/lib/i18n/id.ts` (nav +
strings). Tests: `src/lib/assets.test.ts` (7), `src/lib/onboarding.test.ts`
(+3), `src/lib/permissions.test.ts` (+asset predicates) — 274 total passing.
`tsc --noEmit`, `eslint .`, and `next build` all clean.

**Superseded same day** — see the 2026-08-14 entry above: the user pointed
out assets still weren't actually linked to onboarding, and the manual
toggle was replaced with a fully live derivation from real `AssetCustody`
acknowledgement, same as training. The "no required-assets concept"
observation below no longer applies — completion doesn't need a defined
kit, just zero open custody.

## 2026-08-12 — Phase 3B: Learning Library / LMS

New phase, additive-only against every prior accepted phase including Phase
3A — no existing model, migration, or page was rebuilt beyond adding new
fields/back-relations to `TrainingCourse`/`LearningAssignment`/`FileObject`.
Source of truth: the attached workflow PDF (`phase_3b_learning_library_lms_
workflow.pdf`), covering course authoring, request-or-mandatory-only
assignment, and mode-aware learning/completion.

### Schema: 4 enums, 7 new models, 2 extended models

`CourseStatus` (DRAFT/PUBLISHED/ARCHIVED), `CourseDeliveryMode` (ONLINE/
IN_PERSON/BLENDED), `CourseMaterialType` (PDF/DOCX/PPTX/VIDEO/URL),
`QuizQuestionType` (SINGLE_CHOICE/MULTIPLE_CHOICE/TRUE_FALSE).
`CourseMaterial`, `LearningAssignmentMaterialProgress`, `Quiz`,
`QuizQuestion`, `QuizOption`, `QuizAttempt`, `QuizAttemptAnswer`.
`TrainingCourse` gained `mode`/`objectives`/`status` — `activeFlag` is left
in the schema but superseded; every consumer (Training Request course
picker, Mandatory Rule course picker, learner-facing pages) now filters on
`status: PUBLISHED` instead, and 3 stale call sites were caught and fixed by
grep sweep before any live testing. `LearningAssignment` gained
`certificateExpiryDate`/`certificateFileId`/`attendanceEvidenceNote`/
`attendanceEvidenceFileId`/`quizBonusAttempts`/`overrideReason`. Applied via
the same `prisma migrate diff` → hand-written migration → `prisma migrate
deploy` workaround used throughout this project; the SQLite-specific
table-recreation it generates for the two extended models was inspected
line-by-line to confirm the `INSERT INTO new_X SELECT ... FROM X` step
preserves every existing row before applying.

No new `Notification` model — matches this app's existing convention (every
"notification" is a live-computed nav-badge/personal-inbox, never a stored
row); the PDF's "Notify employee and manager" step reuses the existing
`/training/my-learning` and `/training/learning-assignments` nav-visibility
pattern. No dedicated reset/override schema fields either — quiz-attempt
resets and refresher overrides are tracked the same way every other
override in this app is (an `AuditLog` row with a reason string), with only
`LearningAssignment.quizBonusAttempts`/`overrideReason` as plain counters/
markers, never a duplicated audit trail.

### Server-side quiz scoring, exact-set match, no partial credit

`lib/lms.ts` (11 unit tests) is pure and Prisma-free: `computeQuizAttemptScore`
is points-weighted (not a flat question count) and requires the learner's
selected-option set to *exactly equal* the correct-option set per question —
`MULTIPLE_CHOICE` gets no partial credit for a subset match, matching how
`SINGLE_CHOICE`/`TRUE_FALSE` already behave. `canRetryQuiz` checks attempts
against `Quiz.maxAttempts + LearningAssignment.quizBonusAttempts`, so an
audited reset never mutates historical `QuizAttempt` rows. The learner-facing
submit action (`my-learning/actions.ts`) never trusts client-provided
correctness or scores — every submission re-fetches the question/option set
and recomputes server-side. Live-verified: a real quiz question answered
correctly through the browser scored exactly 100.0% and was recorded as
attempt #1/passed.

### Completion is mode-aware; Online skips the attendance step entirely

`isLearningAssignmentComplete`/`canCompleteOnlineLearningAssignment` encode
the PDF's three completion branches: ONLINE = required materials + quiz (if
any); IN_PERSON = attendance only, regardless of materials/quiz; BLENDED =
both. Online assignments go straight from `ASSIGNED` to `COMPLETED` (no
`ATTENDED` stop) once requirements are met — `completeLearningAssignment()`
branches on `course.mode` and re-checks requirements server-side before
allowing the transition, independent of whatever the admin list page shows.
Competency scores are never touched by completion, and training completion
never rewrites a competency assessment (unchanged from Phase 3A's COM-12
guarantee) — this module doesn't import anything from the competency layer
at all. Live-verified end to end: a fresh Online assignment (material link →
quiz → pass) let Training Admin complete it directly from `ASSIGNED`, while
a second, older assignment for the same employee/course was left untouched.

### Mandatory Training gained a preview step and a refresher override

The PDF's "preview affected employees before confirm" step is a new page
(`/training/mandatory-rules/[id]`) that resolves the audience via the
already-existing `resolveMandatoryTrainingAudience` (unchanged) and shows
who's new vs. already-assigned before the same `applyMandatoryTrainingRule`
action runs. "Prevent duplicate active assignments unless Training Admin
confirms a refresher" required extending `applyMandatoryTrainingRule` with
an optional `refresherReason` parameter: when supplied, every already-
assigned audience member also gets a second `LearningAssignment` row tagged
`overrideReason`, audited with the reason text; when omitted, the original
idempotent skip-if-already-assigned behavior is unchanged. The same
refresher-reason pattern was added to `scheduleTrainingRequest` (Training
Request path) since it previously had no duplicate-assignment check at all —
a real gap caught while implementing this, not called out in the PDF itself.
Live-verified: applying a rule against an employee who already had an active
assignment, with a reason filled in, correctly created exactly one new
`overrideReason`-tagged row and reported "1 new" — the pre-existing row was
left untouched.

### Role-scoped visibility reuses one page per surface, not parallel pages

`/training/learning-assignments` (Admin-owned list) now also admits Manager
(direct reports only, via new `getDirectReportEmployeeIds` — same one-level
granularity as the existing `isDirectManagerOfEmployee`) and HR Manager
(company-wide, read-only) — the query scope narrows per role but the action
buttons (`ConfirmAttendanceButton`/`CompleteForm`/`CancelButton`) only ever
render for the true Admin gate, matching the PDF's "Only Training Admin
manages... attendance, results and certificates." Widening `canAccessImport`
to admit Training Admin for the two new Phase 3B import datasets required
also filtering which upload forms the hub page renders per role, rather than
just widening the outer gate — the same "check what else is behind a
widened gate" discipline applied throughout this app.

### Bulk import reuses the generic ImportBatch/ImportRow framework unchanged

`mandatory-training-participants` and `training-attendance` are two new
`DatasetModule`s (`dryRun`/`commitRow`/`exportData`) registered in the
existing `DATASET_REGISTRY` and reachable through the same `/import` hub as
every other dataset — no changes to the generic upload/preview/commit engine
itself. The participant-list importer reuses the exact refresher-reason
convention from the Mandatory Rule UI (a `refresherReason` CSV column,
required only when the row's employee already has an active assignment);
the attendance importer only accepts a positive "Ya"/"Yes"/"true"/"1" value
for `attended` since there's no "mark absent" workflow anywhere else in this
app to plug into.

### Live verification found and fixed one real bug: stale dev server, not app code

Mid-session, `/training/mandatory-rules` threw `PrismaClientValidationError:
Unknown argument 'status'` — the dev server process had been running since
before the Phase 3B migration and was holding the pre-migration Prisma
Client in memory (the regenerated client files on disk were already
correct, which is why `tsc`/`next build` had passed cleanly). Killing the
process, clearing `.next`, and restarting resolved it — not a code defect.
Separately, live walkthrough surfaced one small real UI bug (not caught by
type-checking): the "Tandai Selesai" material-progress button on
`/training/my-learning/[id]` stayed visually active after an assignment
left `ASSIGNED`, even though the server action already silently rejected the
click — fixed by hiding the button (rather than leaving a dead control) once
`assignment.status !== "ASSIGNED"`.

### Full workflow live-verified end to end, Phase 3A re-confirmed unaffected

Course authoring (Draft → add URL material → create quiz → add a
single-choice question with a marked-correct option → Publish), Mandatory
Rule preview/apply/refresher-override, learner quiz-taking with correct
server-side scoring, and Admin completion of an Online assignment were all
exercised through the actual browser as different demo accounts (Training
Admin, and two real employee-linked logins), not just unit tests. `/training-
requests` and `/competency` (Phase 3A) were spot-checked after all Phase 3B
changes landed and render without error, confirming the additive-only claim
holds in practice, not just by code review.

## 2026-08-11 (later same day) — Phase 3A: Competency & Training Operations

New phase, additive-only against every prior accepted phase (Phase 0/1/2,
Attendance/Absence) — no existing model, migration, or page was rebuilt or
altered beyond adding back-relation fields. Source of truth: the attached
workflow PDF plus the Blueprint spreadsheet's "08 Competency"/"09 Training"/
"03 Roles & Access"/"04 Data Model" tabs, and the real Competency Matrix +
Company Values + historical Evaluation-data workbooks (fetched as XLSX via
the same `.../export?format=xlsx` pattern used for the Phase 1 real-data
migration).

### Schema: 17 new models, purely additive

`CompetencyFrameworkVersion`/`CompetencyDefinition`/`CompetencyLevelIndicator`,
`CompanyValueFrameworkVersion`/`CompanyValueDefinition`/`CompanyValueRubricIndicator`,
`PositionCompetencyRequirement`, `CompetencyAssessmentCycle`/`CompetencyAssessment`/
`CompetencyAssessmentItem`/`CompanyValueAssessmentItem`/`CompetencyEvaluatorChange`,
`TrainingCourse`/`TrainingSession`/`TrainingRequest`/`LearningAssignment`/
`MandatoryTrainingRule`. Applied via the same forward-only
`prisma migrate diff --from-config-datasource --to-schema` → hand-written
migration folder → `prisma migrate deploy` non-interactive workaround used
throughout this project. `PositionCompetencyRequirement` is scoped to **Job**,
not individual Position seats — a documented simplification of COM-05's
"per Position or inherited from Job with a Position-specific override": every
real seat for a Job shares one requirement set in this build, and item-level
snapshotting at cycle-open time already satisfies "never rewrite a completed
result" (COM-17) regardless.

### Real framework data loaded from source, not fictional

`prisma/load-phase3a-competency-framework.ts` is a one-time, re-runnable
(upsert-based) script that fetches the actual "Competency Matrix and Company
Values" workbook, forward-fills Excel's merged-cell blanks, and inserts 81
real competencies (3 General/17 Leadership/61 Work) plus the 5 real Company
Values with their full 0/25/50/75/100 rubric text. Two known source-label
typos (COM-18: "Innitiavite"→Initiative, "Adaptibility"→Adaptability) are
corrected on load with the raw spelling preserved in `aliasesCsv` for the
historical migration's alias resolution.

### P1/P2 routing: derived live, never stored, same convention as every other authority check

`lib/competency-routing.ts` resolves COM-15's routing (normal Employee:
P1=Primary-Position supervisor, P2=Department Head; Level-3 Employee:
P1=Director, P2=HR Manager) at cycle-open time from `Assignment`/
`Position.reportsToPositionId`/existing `dept-head.ts`/`hr-manager.ts`/
`org-chart.ts` helpers — the same "derive from Position/Assignment, never a
stored role" pattern used everywhere else in this app. When an authority
Position has more than one current occupant (e.g. Acting coverage),
`pickSingleEvaluator()` deterministically prefers the PRIMARY-type holder,
else the lowest employeeId, so re-resolving never flip-flops. Live-verified
against real org data: a Level-3 employee's assessment correctly resolved
P1 to the actual Director and P2 to the actual HR Manager position-holder
(who, in this company's real structure, is the same person as the subject
herself for one case — a legitimate self-evaluation outcome of the routing
rule as literally specified, not a bug).

### Gap is a report, never a trigger

Competency gaps (COM-11) and Company Values scores never create a
`TrainingRequest`, `LearningAssignment`, or any other record — the only two
code paths that ever create a `LearningAssignment` are
`scheduleTrainingRequest()` (an approved Training Request) and
`applyMandatoryTrainingRule()` (an active Mandatory Training rule),
confirmed by code inspection and by the historical migration test import
producing zero training side effects.

### Historical migration reuses the generic ImportBatch/ImportRow framework

`src/lib/import-export/competency-migration.ts` implements the same
`DatasetModule` interface (`dryRun`/`commitRow`/`exportData`) as every other
CSV importer and plugs into the existing `/import` hub — HR-Admin-only
(ACC-24), gated by `canRunCompetencyHistoricalMigration`. One row = one
(Employee, Competency, Period) result; several rows for the same
Employee+Period lazily create/attach to one `isHistoricalMigration=true`
`CompetencyAssessment` (its own frozen, `isHistorical=true`
`CompetencyAssessmentCycle`, keyed `HIST-<slug of periodLabel>`). Required
extending `DatasetModule.commitRow` to optionally receive the acting
`Session` (needed for `CompetencyAssessmentCycle.openedByAccountId`) — a
backward-compatible, additive interface change; every existing importer
still only declares the one-argument signature. Company Values are
intentionally never created for historical rows (COM-19: "leave unavailable
Company Values blank" — the source format has no Company Values data at
all). Live-verified against all four named edge cases in one crafted CSV:
valid, invalid employee number, invalid out-of-range required level, and an
exact duplicate row — dry-run correctly flagged 3 of 5 rows with specific
reasons and committed only the 2 valid ones, with achievement% recalculated
correctly (83.33%, hand-verified) and source sheet/row preserved per item.

### Training Request → Course/Session/LearningAssignment, fully live-verified

`TrainingRequest.reason` is free text against a fixed option list (not a DB
enum) — matches TRN-01's open-ended reason categories without a schema
migration if the list changes. TRN-10's "Training Admin validates, selects
or creates the course/session, schedules it and assigns the Employee" is
modeled as two sequential Training Admin steps (`VALIDATED` picks the
course, `SCHEDULED` picks the session and creates the `LearningAssignment`)
so a course can be chosen before a specific date is committed to. Full
lifecycle live-verified end to end: employee self-submission → Department
Head approval (surfaced in the existing `/approvals` personal inbox, same
pattern as every other Dept Head queue) → Training Admin validation →
scheduling, which correctly created the `LearningAssignment` with
`effectivenessRequiredSnapshot` copied from the course.

### Mandatory Training: idempotent audience resolution, five target types

`lib/mandatory-training.ts` resolves all five TRN-13 audience types
(Employee/Department/Job/Primary Position/Everyone) live from current
organization data — never cached. "Prevent duplicate active assignments" is
enforced by checking for an existing non-CANCELLED `LearningAssignment` for
(employee, course) *regardless of which rule or Training Request created
it* before creating a new one. Live-verified: applying a Department-scoped
rule against Production (136 employees) correctly skipped the one employee
who already had a `LearningAssignment` for that exact course from an earlier
Training Request, and re-applying the same rule assigned exactly 0 new
employees.

### LearningAssignment lifecycle and the D+30 effectiveness task

Attendance confirmation, completion (+ optional certificate), and
cancellation are Training/HR Admin actions; effectiveness recording (TRN-04/
TRN-07) is restricted to the assigned Employee's actual Primary Position
supervisor (`isDirectManagerOfEmployee`) or HR Admin — deliberately **not**
Training Admin, matching the spec's literal "the Primary Position supervisor
completes it." Training/HR Admin do get read-only visibility into the
company-wide effectiveness queue (`/training/effectiveness-tasks`, ACC-22's
"administers delivery") — this asymmetry (visible but not actionable) was a
real bug caught during live verification: the page's access gate initially
excluded Training Admin entirely, and the effectiveness-submission form was
rendered unconditionally to every visible viewer regardless of actual write
authority; both are now scoped separately (`canManageLearningAssignment` for
view, `canRecordLearningEffectiveness` per row for the form). Full lifecycle
live-verified: ASSIGNED → attendance confirmed → COMPLETED (effectiveness
due date correctly computed as D+30) → effectiveness recorded as EFFECTIVE
with evidence text, correctly disappearing from the pending queue afterward.

### Permission-scoped exports added alongside every new list

`/api/training-requests/export`, `/api/learning-assignments/export`, and
`/api/competency/gaps/export` mirror the exact visibility scope of their
respective list pages (own/department-scoped for non-admins, everything for
HR/Training Admin) rather than being separately gated — same CTL-13 pattern
as the Attendance/Absence exports.

## 2026-08-11 — Task Force membership: cross-department tag, deliberately not a Position

Direct user request: reflect internal task forces (e.g. "Internal Audit") in employee data as something like a position, but explicitly **not** a Primary position, and explicitly not wanting Struktur Organisasi (Org Unit/Job/Position) setup for it ("anything easier for you"). New standalone `TaskForceMembership` model (employeeId, free-text `name`, optional `roleLabel`, `startDate`, nullable `endDate`, `addedByAccountId`) — deliberately **not** built on Position/Assignment: a task force has no org-chart placement, no reports-to line, and no jobLevel, so modeling it as a real Position risked it being silently picked up by `dept-head.ts`/`level3-scope.ts`'s authority checks (which scan ACTIVE Assignments by `Position.jobLevel`/`orgUnitId`) or by the Additional-Assignment same-department restriction (which would have blocked exactly the cross-department use case this exists for). `name` is free text rather than a separate admin-managed catalog, with a `<datalist>` of previously-used names for consistency — avoids requiring a setup step before first use. New panel on the Employee detail page (`TaskForcePanel`): HR Admin adds/ends memberships (ending sets `endDate`, never deletes — same non-destructive pattern as every other "close" action in this app), visible read-only to the employee themself. Live-verified: added "Internal Audit — Anggota" to an employee, confirmed the name appeared in another employee's autocomplete datalist, ended the membership (moved to a "Riwayat" history section with start/end dates), and confirmed the subject employee sees it read-only with no edit controls.

## 2026-08-10 — Phase 2 Extension: Attendance & Absence (Mobile GPS+selfie check-in, Fingerprint import, daily reconciliation with live-derived exceptions, two-stage Cuti/Izin/Sakit/Lainnya workflow)

New module, additive-only (no existing accepted functionality touched). Schema: 4 enums (`AttendanceMethod`, `AttendanceEventType`, `AttendanceSource`, `AbsenceType`) + 1 enum (`AbsenceStatus`, 5 values) + 7 models (`AttendanceGeofence`, `AttendanceAssignment`, `AttendanceEvent`, `DailyAttendanceRecord`, `AbsenceApproverConfig`, `AbsenceEntitlementConfig`, `AbsenceRequest`), applied via forward-only migrations using the established `prisma migrate diff --script` → hand-written migration folder → `prisma migrate deploy` non-interactive workaround.

### No per-employee/admin-configurable work schedule — one fixed company default

Originally built with a full `WorkSchedule` admin model (HR Admin creates named schedules: start/end time, grace minutes, work days, assigns one per employee) — per direct user follow-up request, this was removed entirely. Every employee now shares one hardcoded policy in `lib/attendance.ts`: 07:30 start, Mon–Thu closes 16:30, Friday closes 17:00, 10-minute grace. The Friday/Mon-Thu end-time split doesn't need to be day-aware in the exception logic since end time is purely informational — only `LATE_CHECK_IN` and missing-punch exceptions are ever computed, and both depend only on start time + grace, which is the same every day. Removing `WorkSchedule` meant a second corrective migration (dropping the table and its two FK columns from `AttendanceAssignment`/`DailyAttendanceRecord`) plus deleting the `/admin/work-schedules` page outright — HR Admin's attendance-assignment form now only picks Method (Mobile/Fingerprint) and, for Mobile, an optional Geofence.

### Exceptions are derived live, never stored

Same "derive, don't store" convention as `deriveEmployeeLifecycleStatus`: `DailyAttendanceRecord` is purely a "this day has been swept by reconciliation" marker (linking whichever check-in/check-out events exist), not the source of exception data. `deriveDailyAttendanceExceptions()` in `lib/attendance.ts` always computes `MISSING_CHECK_IN`/`MISSING_CHECK_OUT`/`LATE_CHECK_IN`/`OUTSIDE_GEOFENCE_CHECK_IN`/`OUTSIDE_GEOFENCE_CHECK_OUT` fresh from the linked `AttendanceEvent` rows every time the Attendance Records page or its export loads — a stale record never lies about a fact that later became knowable differently.

### Fingerprint import reuses the existing generic ImportBatch/ImportRow framework

Rather than building a bespoke one-shot import (the ZIP-bundle precedent), `src/lib/import-export/fingerprint-attendance.ts` implements the same `DatasetModule` interface (`dryRun`/`commitRow`/`exportData`) as the Employee/OrgUnit/Job/Position/Assignment CSV importers and plugs into the same generic preview→commit pipeline and `/import` hub page. The only generalization needed to the shared framework: `uploadAndPreviewImport` now detects `.xlsx`/`.xls` by extension and converts via the newly-added `xlsx` (SheetJS) package before handing rows to the same `dryRun`. Dedup is enforced two ways — against rows already committed to the database, and against earlier rows in the same file — since a re-exported machine log commonly overlaps the previous export's date range. `AttendanceEvent` deliberately carries no FK back to the `ImportRow` that created it (removed after initially adding one) — the generic framework's own `ImportRow.createdRecordId` already gives full traceability, and `commitRow`'s signature never receives its own row id, so the reverse FK could never be populated.

### Known risk: `xlsx` package has unpatched CVEs

SheetJS's npm-registry `xlsx` package carries known prototype-pollution and ReDoS advisories that the maintainer only patches via their own CDN, not npm. Accepted as a reasonable risk here since the upload path is HR-Admin-only (already permission-gated), not public-facing — flagged to the user directly rather than silently accepted.

### Absence first-approver is an explicitly HR-Admin-configured Position per Department, not derived

Deliberately distinct from the Dept-Head-3B-derived-from-jobLevel pattern used by every other workflow in this app (Recruitment, Movement, Offboarding) — the spec calls for a configured Position, not one implied by org-chart level. `AbsenceApproverConfig` is a simple one-row-per-Department table; "who currently holds that Position" is resolved the same way `reportsToPosition.currentHolders` is displayed elsewhere (`Employee.currentPositionId` equality), pulled into a small shared `lib/position-holder.ts` helper reused by both the decide action and the detail page's visibility check.

### HR Admin override is an in-place overwrite, not a correction record

Per spec ("no separate correction record"): `AbsenceRequest.isHrOverride`/`hrOverrideReason`/`hrOverrideAt`/`hrOverrideByAccountId` overwrite the status field directly, only reachable from an already-decided (`APPROVED`/`REJECTED`) request, always requiring a reason. Verified live: an approved Cuti request corrected to Rejected retained the full original decision trail (first-approver + HR Admin decision) alongside the override, with a visible "Dikoreksi oleh HR Admin" badge.

### Absence attachment file access widened to match who can decide the request

`/api/files/[id]` originally only allowed the file's own employee or HR Admin (`canViewEmployeeDocument`) — for an Absence attachment (e.g. a Sakit doctor's note) this would have 403'd the exact people the approval workflow depends on (the configured first-approver, a Level-3 holder in the employee's department) even though they're authorized to view the request itself. Widened with a narrow, category-scoped check (`file.category === "ABSENCE_ATTACHMENT"`) that re-derives the same scope `canViewAbsenceRequest` uses, rather than loosening the route's general self-or-HR-Admin default.

### Live-verified end to end

Assigned Mobile+Geofence and Fingerprint methods via the Employee detail panel; confirmed the Fingerprint persona sees no manual check-in/out action; ran the Fingerprint dryRun/commitRow pipeline directly against valid, duplicate, and unregistered-device rows and confirmed correct accept/reject behavior; confirmed the Attendance Records page correctly shows "Belum ditugaskan" for unassigned employees, "Belum Check-in"/"Belum Check-out" for assigned-but-unpunched employees, and a clean "Tidak ada pengecualian" for an on-time in-window punch; ran a full Absence request through submit → first-approver approve → HR Admin approve → HR Admin override, and confirmed the overlap-validation rejection message names the conflicting request number. GPS/selfie capture itself couldn't be exercised end-to-end in the headless browser test environment (no real camera/GPS hardware) — the check-in/out UI, geolocation-capture flow, and server-side validation were verified by code review and by confirming the page correctly gates on `AttendanceAssignment.method` per persona.

## 2026-08-06 — `jobLevel` moved from `Job` to `Position`; Jobs/Positions admin forms and every picker updated to match

Reverses part of the previous day's real-data migration decision. `Job.jobLevel` was a derived approximation (first-seen Position's level, backfilled once at import time) — a workaround for not having a real per-seat level field. The user proposed the cleaner model directly: **level is a property of the seat, not the abstract role** — the same Job (e.g. "Operator CNC") is legitimately held at different grades across different Positions ("1B Operator CNC" vs "1C Operator CNC"), matching the migration sheet's own real structure (`04_POSITIONS.job_level_code`; `03_JOBS` carries no level at all). Motivated directly by a real problem: the Recruitment Request form's "Posisi yang Diminta" picker listed all 157 real Positions, many with identical-looking job titles and no way to tell them apart without opening each one.

### Schema: two-phase migration, same pattern as the 2026-08-04 Evaluation entity

Phase A: added `Position.jobLevel` (nullable), dropped `Job.jobLevel`. Phase B (after backfill): tightened `Position.jobLevel` to required. `prisma migrate dev` couldn't run non-interactively in this environment once it detected the data-loss warning on dropping `Job.jobLevel` (61 non-null values) — worked around it by generating the SQL via `prisma migrate diff --script`, writing it into a migration folder by hand, and applying with `prisma migrate deploy` (non-interactive). Re-fetched `04_POSITIONS.job_level_code` directly over HTTP (same reliable pattern as the original migration script — bypasses the WebFetch tool's summarization) and backfilled all 157 Positions with their real, exact level — recovering the precision the original derivation had approximated away for the 14 previously-duplicate-graded job names.

### Every consumer updated, including the two authority-derivation files

`src/lib/dept-head.ts` and `src/lib/level3-scope.ts` — the Dept Head (3B) and Level-3 (3A/3B) authority checks used by Recruitment, Movement, Contract Renewal, Offboarding, and Shift Assignment — queried `position: { job: { jobLevel: ... } }`; changed to `position: { jobLevel: ... }` directly. Verified directly against real data post-migration: `POS-0034` (Manager Human Capital, held by the real employee "Gayatri Kartika") still resolves with `jobLevel: "3B"` and 6 Positions company-wide sit at 3A/3B, matching pre-change expectations exactly. Also updated: `org-chart.ts`/`org-chart-client.tsx` (org chart still shows the right level per card), `movement.ts`'s `validateJobLevelDirection` callers (Movement and Contract Renewal's Promosi/Demosi direction check now reads `position.jobLevel` instead of `position.job.jobLevel`), the Jobs admin form (level field removed), the Positions admin form (level field added, required), and both CSV import/export modules (`jobs.ts` column removed, `positions.ts` column added).

### New display convention: `"{level} {jobTitle}"`, applied to the duplicate-heavy pickers specifically

Per the user's example (`1B Operator CNC`), applied to every dropdown that lists Positions for selection — Movement's proposed-Position picker, Contract Renewal's proposed-Position picker, the Positions admin list — since those are exactly the "which of these identical-looking rows is the right one" pickers the whole change was motivated by. The Recruitment Request form's Job-only picker (HR Manager sets `jobId` at Approve time, before any Position exists) lost its level suffix entirely rather than showing a stale one, since Job no longer carries a single level to show. The org chart's own card layout (`{department} · {level}`) was left as-is — an established visual design, not part of the motivating problem, just repointed to the correct new data source.

### Explicitly not done yet

Redesigning the Recruitment Request submit form itself (replacing the 157-row Position picker with a Job picker + a level field the requester fills in) was discussed as a natural next step but not built — only the schema/display groundwork was confirmed and shipped. `Employee.preferredName` removal (raised in the same session, ~205 references across 40 files) was started and explicitly paused by the user ("we can do this later on final version") — the schema field was restored and no files were left half-migrated; this is a separate, still-open item.

## 2026-08-05 (later same day) — First real-data migration: demo dataset replaced with the real org chart + 183-employee UAT dataset

All demo/seed data (Employees, OrgUnits/Jobs/Positions, Assignments, Contracts, and every downstream workflow record — Recruitment/Movement/Evaluation/ContractRenewalCase/OffboardingCase/ShiftAssignment/OnboardingCase/FileObject/AuditLog) was wiped and replaced with the real organization structure and a 183-employee UAT dataset from the user's "HR App Real Data Migration – Phase 2 UAT" Google Sheet — the same spreadsheet reviewed tab-by-tab over the preceding several turns (`11_FIELD_MAP`, `01_IMPORT_CONTROL`, `02_ORG_UNITS`/`03_JOBS`/`04_POSITIONS`/`05_EMPLOYEES`/`06_ASSIGNMENTS`/`07_CONTRACTS`).

### What was loaded

6 Departments (Finance & Procurement, Human Capital, Management, Production, Quality Development, Sales & Marketing), 61 deduped Jobs, 157 Positions, 183 Employees, 183 Assignments, 183 Contracts. The 3 `ADMIN` accounts (hr.admin/training.admin/ga.admin) were preserved — they carry no `Employee` link and are still needed to operate the app. The 3 fictional `EMPLOYEE_LOGIN` demo accounts and their Employee rows were deleted along with the rest of the demo data; real employee login accounts remain explicitly out of scope for this round (`08_USER_ACCOUNTS` was put on hold earlier in this same review). `AuditLog` was cleared too, for a genuinely clean start rather than 570+ stale events about deleted demo records.

### No "Company" root OrgUnit — Departments rooted at `parentUnitId=null`

The sheet's `02_ORG_UNITS` had a root `ORG-CBP` row typed `"Company"` — a value my `UnitType` enum (`DEPARTMENT | SECTION | GROUP | TEAM`) has no slot for. Rather than widen the enum, the import skips that row entirely and roots all 6 Departments directly (same as the pre-migration demo data already did) — nothing in the app actually needs a modeled "Company" node, since `Position.reportsToPositionId` (not `OrgUnit` nesting) drives the real reporting chain and org chart. This was briefly reopened when a synthetic Harian-employee pool Position needed *some* org-unit home and was initially pointed at `ORG-CBP` — resolved by pointing it at a real Department (Production) instead once the user clarified Harian Lepas employees should hold a real Position like everyone else ("harian is like magang, PKWT... put all harian in operator first"), not a company-wide placeholder. That pool Position (`POS-UAT-GENERAL-OPERATOR`, capacity 27, job `JOB-072` "Operator Assembly &Finishing") now sits under Production like every other seat.

### `Job.jobLevel` derived from Position at import time

The sheet moved `job_level_code` off `03_JOBS` entirely and onto `04_POSITIONS` only (each of the 61 canonical Jobs can now be held at a different grade per seat — e.g. "Operator CNC (CNC Lathe)" spans 1A/1B/1C across different Positions). Per direct user instruction ("keep job level separate not position" — i.e. don't add a new `Position.jobLevel` column to the app schema), `Job.jobLevel` (still a required field) is instead derived once at import time from whichever Position with the lowest `position_code` references that Job. Exact for the ~47 Jobs held at only one grade; an approximation for the 14 previously multi-graded job names — functionally inconsequential either way, since no authority check (`dept-head.ts`/`level3-scope.ts`) reads any level below `3A`/`3B`, and none of those 14 groups reach that tier.

### Jobs deduped by the user directly in the sheet, not by me

An earlier plan to have me dedupe `03_JOBS` (81 rows → 61 canonical, collapsing 14 duplicate-name groups down to one Job each) was overtaken by the user doing it themselves directly in the live sheet — faster and more reliable than the alternative I was about to attempt (blind browser automation on a real shared document; the Browser pane wasn't compositing frames for screenshot verification, and Google Sheets renders its grid/dropdowns on canvas, invisible to the accessibility tree — flagged as unsafe to proceed with rather than guessing). Their rule ("keep the lowest job_code number" per duplicate name) independently produced the identical correct result to the tie-break I'd proposed for the two trial-status exceptions (Specialist Procurement → 2B, Team Leader Quality Control → 2A — both employees were mid-probation at a lower grade when the duplicate rows were first created), since those two survivors happened to already be the lowest-numbered code either way.

### How the import was actually run

A one-off `prisma/migrate-real-data.ts` script (deleted after use, same throwaway-script precedent as the 2026-08-04 evaluation backfill) fetched all 6 source tabs **directly over HTTP** (`fetch()` + `papaparse`) rather than through the WebFetch tool — WebFetch's own LLM-summarization step proved unreliable for exact, complete data at this scale (row counts drifted across repeated calls on `05_EMPLOYEES`, with one fetch silently truncating around row 176 of ~183). The script ran a referential-integrity dry-run pass first (org_unit_code/job_code/position_code/employee_number/assignment_code all resolve) — zero errors, zero orphaned rows — before wiping anything. Any future re-import of this sheet should follow the same pattern: fetch the gviz CSV export URL directly in code, never rely on a summarized fetch for data that gets written to the database.

### Two cosmetic data quirks, not app bugs

1. The sheet's `preferred_name` column is a synthetic placeholder (`"UAT-0001"` etc.) for every single row, not a real nickname — so every employee currently displays as "UAT-NNNN" in the list/detail header (existing `preferredName ?? fullLegalName` behavior, unchanged and correct); the real name is intact in `fullLegalName`, shown further down the detail page. Flagged to the user rather than silently overridden.
2. After the wipe+reload, the already-running dev server process started silently failing to log in (no error, no request even firing) — a full process restart (kill + fresh `npm run dev`) fixed it immediately. Worth remembering: restart the dev server after any direct-database write of this kind before assuming a login/behavior regression is a real app bug.

Live-verified post-migration: dashboard shows 183 active employees / 0 vacant positions; org chart renders the full real reporting chain (Komisaris → Direktur → Managers → ... down to Operators) with correct job-level labels; a real employee detail page shows the correct name/position/department; the contract list shows real Harian Lepas contracts with correct end dates and department filters. No console errors beyond expected dev-server HMR reconnect noise from the restart.

## 2026-08-05 (later same day) — Employee lifecycle display status derived, not stored; Contract.primaryAssignmentId added

Two more decisions surfaced by the migration template's `11_FIELD_MAP` tab (source-to-canonical field mapping), reviewed together against the app's actual schema.

### Employee lifecycle status (Akan Masuk / Active / OUT): no new stored field

The sheet's `05_EMPLOYEES.active_flag` row named a 3-state display concept — "Display only: Akan Masuk when activeFlag is TRUE and hireDate is after today; Active when TRUE and hireDate is today/past; OUT when FALSE" — using the word "employment_status" in an earlier draft of the same tab, which collided with the *existing* `Employee.employmentStatus` field (contract type, synced from the active Contract — an unrelated concept). Rather than add a redundant stored column, `deriveEmployeeLifecycleStatus(activeFlag, hireDate, now)` in `src/lib/employee-lifecycle.ts` computes the 3-state label live from the two fields Employee already has — same "derive, don't duplicate" pattern as `computeExpiryUrgency`/`OnboardingOverallStatus`/etc. Shown as a badge on the Employee detail header (next to the existing contract-type badge) and a new "Status Karyawan" column on the Employee list. No schema change, no migration.

### `Contract.primaryAssignmentId`: new optional FK, required by business validation for new contracts

The sheet's `07_CONTRACTS.primary_assignment_code` row: "resolve Assignment.assignment_code to its internal Assignment ID... Database field is optional for legacy contracts; required by business validation for every new or generated contract." `Contract` previously only linked to `Employee`, with no way to record *which* Position/Assignment a given contract was for — a real gap once an Employee can hold different Positions over time across multiple contracts. Added `Contract.primaryAssignmentId String?` (nullable at the DB level, per "legacy contracts may remain blank") and a shared `getActivePrimaryAssignment(employeeId)` resolver in `contract-mutations.ts`. Every contract-creation action now resolves and requires it, returning a blocking error if the employee has no active Primary Assignment:
- `createContract` (manual baseline) and `createRenewalDraft` (manual renewal) — both resolve the employee's current active Primary Assignment.
- `decideRenewalCase`'s "Perpanjang 3/6/12" branch (D-30 case, no Position change) — same resolver.
- `createRenewalContractAfterMovementExecuted` (post Mutasi/Demosi) — uses the just-executed Movement's own `implementedAssignmentId` instead of a fresh lookup, per the sheet's "Contract generation must use the Position attached to that Assignment" — more precisely traceable than re-deriving "current Primary" generically, even though both would coincide here.

Displayed on the Contract detail page ("Penempatan Utama") when set. Live-verified: creating a contract for an employee with no active Primary Assignment was correctly blocked with an error; creating one for an employee who has one succeeded and the Position/department were displayed as expected.

## 2026-08-05 — Contract release now needs HR Manager approval; Offboarding resignation gets a Dept Head stage; new Shift Assignment module

Three separate, direct user requests made while reviewing the real-data migration template's "Authority & Lifecycle" tab, in preparation for clearing demo data and loading the real 200-employee/org-chart dataset.

### Contract release: HR-Admin-only → HR-Manager-approved

WF-10/LIF-09 previously had HR Admin release every Draft contract unilaterally, same as it prepares/administers everything else in the pipeline. Per direct request ("make a gate on HR manager approval for all contract"), releasing now needs an active HR Manager Position — same Position-derived-only authority as every other HR Manager decision in this app, with the same WF-02 evidence pattern (`Contract.releasedByAccountId`/`releasedByPositionId`, additive fields). Deliberately *only* release changed — draft/sign/activate stay HR-Admin-only, since nothing in the request or the existing model asked for more, and widening every stage would blur "HR Admin operates, HR Manager decides" past what was asked. Applies uniformly regardless of how a contract reached Draft (manually created, or auto-generated by an approved Contract Renewal Case) since Release is always the same distinct action/status transition either way. `ReleaseButton` (a zero-arg `SimpleActionButton`) became `ReleaseContractForm`, reusing the existing `DecisionPositionField` pattern.

### Offboarding resignation: added a Dept Head stage ahead of the HR Manager

Per direct request, replying "no need" to a Director-approval idea from the migration tab but adding instead: "Termination only need dept head approval and HR manager like evaluation." Read as: the `RESIGNATION` path should get the same Dept-Head(3B)-then-HR-Manager two-stage chain already used by Recruitment/Movement/Contract Renewal, since it previously had *only* an HR Manager stage — asymmetric with every other multi-stage workflow in the app. `OffboardingCaseStatus` gained `PENDING_DEPT_HEAD` ahead of `PENDING_HR_MANAGER`; `initialOffboardingCaseStatus` now returns it for `RESIGNATION`. **`CONTRACT_NON_RENEWAL` is untouched** — its Dept-Head/HR-Manager rationale already lives on the source `ContractRenewalCase`'s own combined decision (LIF-12, 2026-08-04 entry), so re-adding a second Dept-Head gate there would directly contradict that documented "never re-decide" design; it still starts straight at `PENDING_CLEARANCE`. New `decideOffboardingCaseAsDeptHead` action mirrors `decideMovementRequestAsDeptHead` (same self-approval guard, same department resolution via `resolveDepartmentId` off the employee's current Position, same WF-02 evidence fields — `deptHeadDecisionAt/ByAccountId/PositionId/Note`). `canViewOffboardingCase` widened to admit an active Dept Head for the employee's department, same "outer view gate must not be narrower than the inner action gate" fix already applied twice before (recruitment 2026-07-30, Contract detail 2026-08-04) — flagged in memory as a recurring pattern worth checking on every future two-stage-approval page.

### New Shift Assignment module

Per direct request: "I want to be able to assign shift or non shift for each employee... changes weekly and will be submitted by level 3... can manually override by HR." No shift/roster entity existed anywhere except `RecruitmentRequest.shiftCode` (a 2-value Shift/Non-Shift enum on the *request*, not an ongoing per-employee schedule) — this needed genuine new schema, not a column addition. New `ShiftAssignment` model: one row per `(employeeId, weekStartDate)` (`@@unique`, Monday-normalized via `normalizeWeekStart` in `src/lib/shift-assignment.ts`), `shiftType: SHIFT_1 | SHIFT_2 | SHIFT_3 | NON_SHIFT` (matching the migration template's own 4-value "shift" lookup category — reconciles "assign shift or non shift" with "for shift they work shift1/2/3" as one enum, not two concepts), an optional free-text `note`, and an `isHrOverride` boolean instead of a second set of actor fields — since only the current value per employee/week matters (an upsert, same "current state, not a full edit history" simplification already used for `Employee.currentPositionId`; full change history still lives in `AuditLog`). Submission reuses Level-3 (3A/3B, employee's own department) eligibility from `src/lib/level3-scope.ts`, unchanged from Perubahan Posisi's own submit gate; HR Admin can submit/override the same way, flagged via `isHrOverride` rather than a formal Dept-Head/HR-Manager decision chain — the request describes a lightweight weekly operational task ("submitted by level 3... manually override by HR"), not a multi-stage approval, so no `decisionPositionId` picker was added; the submitter's first active Level-3 Position is recorded automatically as evidence instead. New `/shift-assignments` page: a per-department (or, for HR Admin, company-wide) grid for the current week, one inline form per employee row. Linked from the Employee detail page and the main nav (visible to HR Admin or anyone holding an active Level-3 Position).

All three verified live end to end: Contract release denied to HR Admin alone, succeeded once logged in as an active HR Manager (status Draf → Dirilis, evidence recorded); a reported resignation started at `PENDING_DEPT_HEAD`, appeared in the Dept Head's Approval Inbox (new queue section, scoped by department the same way Movement's already does), and advanced to `PENDING_HR_MANAGER` on approval; a Shift Assignment submitted by HR Admin round-tripped correctly with the override badge shown.

## 2026-08-04 (later same day) — Offboarding: resignation report and non-renewal handoff, both ending in HR Admin exit clearance (LIF-06/07/12, WF-10, GA-05, DSH-08/09/14)

### Two triggers, one shared case creator, two different starting statuses

The Build Guide gives no dedicated Offboarding data-model or workflow tab — the spec lives entirely in LIF-06 ("Resignation or contract-end case > manager input when required > HR Manager decision/oversight > HR Admin exit-clearance execution > Account Disable"), LIF-07 (no hard delete), LIF-12 (non-renewal handoff), WF-10's one-line "Tidak Diperpanjang > Offboarding Handoff", GA-05 (asset-return blocker), and tab 15's In-App Review scenario. Built a new `OffboardingCase` model with `reason: RESIGNATION | CONTRACT_NON_RENEWAL` and a 4-value status (`PENDING_HR_MANAGER`, `PENDING_CLEARANCE`, `COMPLETED`, `CANCELLED`) — "manager input when required" is captured as data at report time (`managerNote`), not a separate stored stage, so a resignation starts at `PENDING_HR_MANAGER`; a non-renewal handoff's Dept-Head/HR-Manager rationale already lives on the source `ContractRenewalCase`'s own combined decision (see the 2026-08-03 entry), so that case starts directly at `PENDING_CLEARANCE`, deliberately never re-running the same decision a second time. Both paths call one shared internal creator (`createOffboardingCaseInternal`, same "one creator, every source calls it" pattern as `createDraftEvaluation`) — `reportResignation` (HR Admin or the employee's direct manager, via `isDirectManagerOfEmployee`) and `createOffboardingHandoff` (HR Admin, from an `APPROVED` + `TIDAK_DIPERPANJANG` renewal case) are its only two callers.

### `clearanceDueDate` = `lastWorkingDay` — a documented simplification

No day-count rule for offboarding clearance exists anywhere in the Build Guide (unlike Evaluation's explicit WF-18 "5 working days"). Clearance is due by the last working day itself — the most literal reading absent a stated number. One visible consequence: a same-day case shows the "Terlambat" (overdue) badge almost immediately, since `isOverdue` compares against midnight — acceptable for now, flagged here rather than inventing an unstated grace period.

### GA-05's asset-return blocker: flagged, not faked

"Exit Clearance cannot complete while employee-assigned assets remain open" can't be enforced — Assets (Phase 4) isn't modeled in this schema at all (same "don't build ahead of phase" restraint already applied to GA/Training/Assets elsewhere). `executeExitClearance` shows a fixed notice asking HR Admin to confirm assets are returned manually; no placeholder checkbox was added, since that would fake a check nothing is actually verifying. Revisit once Phase 4 ships a real Asset model.

### Exit clearance and Account Disable are one action

LIF-06 chains "...execution > Account Disable" with no described intermediate gate, so `executeExitClearance` does both in one HR Admin click: ends every `ACTIVE` Assignment as of `lastWorkingDay` (never deletes — LIF-07), clears `Employee.currentPositionId`/`activeFlag`, and disables the linked `Account` (`accountStatus: DISABLED`, reusing the field that already existed for admin-disable/login-lockout) if one exists — a no-op, not an error, for the common case of an employee with no login account at all. Live-verified against an employee with zero assignments/no account (clean no-op) and one with an active Assignment (closed correctly, Position `positionStatus` synced back to VACANT via the existing `syncPositionStatus`, though the date-projected org chart correctly keeps showing the holder through their future last working day — same effective-dated-vs-status-based duality `executeMovementRequest` already has, not a new inconsistency).

### Two real bugs the non-renewal handoff path surfaced, both fixed

Testing the `CONTRACT_NON_RENEWAL` path end to end (a fresh D-30 case → release → P1/P2 complete → Dept Head recommends Tidak Diperpanjang → HR Manager approves → HR Admin creates the handoff) surfaced two genuine, pre-existing defects unrelated to Offboarding's own code:

1. **`canViewContractDetail` had no Dept Head 3B branch.** An active Dept Head for the employee's own department could be blocked from ever reaching the Contract page to submit their D-30 recommendation, whenever they weren't also that employee's literal `isDirectManagerOfEmployee` — which is *always* true for the department head's own renewal case, since by definition nobody reports directly to the person at the top of the department. Widened the predicate to also admit `isDeptHeadApprover(activeDeptHeadPositionIds)`, and hoisted the department/Dept-Head-positions lookup in `contracts/[id]/page.tsx` above the view gate so both the gate and the D-30 section below it share one computation. Same class of bug as the recruitment `isHrManagerNow` gap from 2026-07-30 — the outer view gate and the inner action gate had drifted apart.
2. **`releaseEvaluation` never advanced `ContractRenewalCase.status` from `TRIGGERED` to `EVALUATION_SENT`.** WF-10 requires that transition, and it lived on the case's own field, separate from the shared `Evaluation.status` — but nothing in the generic, source-agnostic `releaseEvaluation` action (built for the 2026-08-04 shared-Evaluation refactor) ever touched it. Every renewal case created *before* that refactor still carried a valid `EVALUATION_SENT` from the old embedded-fields era (preserved by the migration), which is why this went undetected — the refactor's own live verification reused that pre-existing data instead of walking a brand-new case through release from scratch. Fixed by having `releaseEvaluation` flip a linked `TRIGGERED` case to `EVALUATION_SENT` as part of the same release. One already-affected case created during this session's testing was corrected via a throwaway one-off script (deleted after use, same precedent as the earlier backfill scripts) since its Evaluation had already been released before the fix landed; no other real case was affected.

Live-verified both full paths end to end with fresh data: a resignation reported by HR Admin → approved by HR Manager → cleared by HR Admin (twice — once for an employee with no Assignment/Account, once for one with both); and a full D-30 renewal case walked to an approved Tidak Diperpanjang decision → one-click handoff creation (pre-filled, no re-entered data, skipping the HR Manager stage) → exit clearance, with the reverse link back to the source Contract visible on both sides.

## 2026-08-04 — Shared Evaluasi Kinerja workflow: one FR-HC-01-07 entity for Contract Renewal, Perubahan Posisi and Manual HR; Contract + Contract Renewal consolidated into one module (DM-26/27, WF-19, ACC-17, LIF-14, PER-07, DEC-009/018/019/020)

### One `Evaluation` entity replaces the renewal-only embedded implementation

The build guide's updated spec generalizes the FR-HC-01-07 evaluation that was previously embedded directly on `ContractRenewalCase` (see 2026-08-03 entry above) into a shared entity reused by three sources: Contract Renewal (draft at D-30), Perubahan Posisi (draft auto-created on Promosi/Mutasi/Demosi submission, no requester trigger), and Manual HR (HR Admin creates ad hoc). WF-19 is explicit: "One reusable entity and workflow only. Do not keep an embedded renewal-only evaluation implementation" — so this was a migration, not an addition alongside the old one.

**FK placement: on the source, not on `Evaluation`.** The blueprint describes a generic `source_type`/`source_id` pointer, but this codebase's established idiom is concrete typed FKs. The two don't compose the same way here: LIF-13 requires a Mutasi/Demosi that comes out of a completed renewal case to *reuse* that case's already-completed Evaluation rather than create a second one — meaning one `Evaluation` row must be referenced by both a `ContractRenewalCase` and a `MovementRequest` simultaneously. A single owning FK on `Evaluation` can't represent that; `evaluationId` on each source table (`ContractRenewalCase.evaluationId`, `MovementRequest.evaluationId`), both nullable uniques, can.

**Migration was three phases, verified data-preserving at each step**, since resetting seed data was explicitly out of scope: (1) additive migration adding the new `Evaluation` table + nullable `evaluationId` FKs, (2) a one-off `tsx` backfill script using the real Prisma Client (not raw SQL) copying `REN-2026-0001`/`REN-2026-0002`'s embedded scores into new `Evaluation` rows (`EVL-2026-0001`, `EVL-2026-0002`), verified against the pre-migration values (Budi 84, Siti 112) both immediately after backfill and again after phase 3, (3) a cleanup migration dropping the now-redundant embedded columns from `ContractRenewalCase` — generated via `prisma migrate diff` + a manually-created migration folder + `prisma migrate deploy`, since `prisma migrate dev` refuses non-interactive confirmation for a data-loss migration even with `--create-only`.

**Status is still coarse, sub-stages still derived live**: `EvaluationStatus` has 6 values (`DRAFT`/`RELEASED`/`COMPLETED`/`RETURNED`/`CANCELLED`/`VOIDED`) — "Waiting P1/P2/Both" from the spec prose is a UI-only label derived from `p1SubmittedAt`/`p2SubmittedAt` while `RELEASED`, never a stored sub-state, same "derive, don't duplicate" pattern `ContractRenewalCaseStatus` already used.

### Contract + Contract Renewal Case: one module, per direct user instruction ("never make the same things 2 module")

Kept `Contract` and `ContractRenewalCase` as two Prisma tables (the blueprint's DM-14/DM-15 still describe them as distinct entities with different lifecycles), but fully merged the UI: the `/contract-renewals` route, its own nav item, and its list/detail pages were deleted outright; the D-30 case now renders inline at the bottom of `/contracts/[id]` (case header, embedded `EvaluationPanel`, Dept Head recommendation, linked-movement, HR Manager decision, generated-contract link — all the same content the old separate page had, just inline). `/contracts` gained a "Nomor Kasus" column showing the case number + status per row instead of requiring a second navigation. One nav item, one list, one detail page per contract.

### Reusable `EvaluationPanel` avoids tripling ~150 lines of JSX

`src/app/(app)/evaluations/evaluation-panel.tsx` is an async Server Component (`{ evaluationId, linkToDetail? }`) doing its own permission check and Prisma fetch, rendering `null` for an unauthorized viewer rather than blocking the whole host page. Embedded identically in three places: the standalone `/evaluations/[id]` detail page, inline on `/contracts/[id]` for the D-30 case, and inline on `/movements/[id]` for the auto-created Promosi/Mutasi/Demosi draft — the last of which was missing entirely until live testing surfaced it (see below).

### Two gaps found only by live click-through, not by typecheck/lint/tests

Both were things that typechecked cleanly and had no test coverage gap, because the bug wasn't in the pure logic — it was in UI wiring that nothing exercises except actually loading the page as a user:

- **`movements/[id]/page.tsx` never rendered the linked Evaluation at all.** The backend (`movements/actions.ts`) auto-creates the Draft and gates Dept Head/HR Manager decisions on it, but the detail page had zero reference to `evaluationId` — an HR Admin had no way to release it or assign P1/P2, and a Dept Head would just see a decision button that fails with no explanation. Added the `EvaluationPanel` inline, plus a `decisionBlockedByEvaluation` notice mirroring the Contract Renewal page's existing "blocked, here's why" pattern, so the button doesn't appear only to fail.
- **The submit form still forced `performanceEvaluationRef` as `required` for Promosi only.** That field was the *pre-refactor* placeholder evaluation mechanism (see 2026-08-03 entry); now that a real Evaluation auto-creates for all three Perubahan Posisi types, the backend never enforces this field — but the form still blocked submission without it, only for Promosi. Relabeled it "Referensi Tambahan (opsional)", dropped `required`, and widened its visibility to all three types (it's genuinely optional supplementary text now, not type-specific).

Live-verified end to end with fresh data (not just the backfilled `EVL-2026-0001`/`EVL-2026-0002`): submitting a Promosi with the reference field left blank succeeded and auto-created `EVL-2026-0003` as a Draft with no requester-visible trigger; HR Admin released it assigning P1/P2 from the movement's own detail page; P1 and P2 each saw and could submit only their own slot (scores hidden from each other and from the subject employee); submitting the second slot auto-transitioned the Evaluation to Completed; the `/evaluations` list, `/my-evaluations`, and `/approvals` (rewritten to query `Evaluation` directly instead of the now-removed `ContractRenewalCase.p1EmployeeId`/`p2EmployeeId`/`sentAt` fields) all reflected the change correctly; a Manual HR evaluation (`EVL-2026-0004`) was created standalone with no linked source; revisiting `/contracts` and `/evaluations` repeatedly across the session never produced a duplicate Evaluation for the same contract (idempotency via the unique `currentContractId` constraint, unchanged from the original D-30 trigger design).

## 2026-08-03 — Contract Renewal Case: FR-HC-01-07 dual-evaluator workflow, linked Perubahan Posisi, combined HR Manager decision (DM-15, DM-26, WF-10..12, LIF-08..13, ACC-11/16, DEC-009/019)

### A second, richer renewal workflow — additive alongside the existing simple one, not a replacement

Discovered mid-inspection: Contract renewal already existed (`20260730035218_contract_renewal_wf10`), but as a single-recommender pipeline (`Contract.reviewRequestedAt/recommendationSubmittedAt/recommendation/decisionAt`, driven by `isDirectManagerOfEmployee` + HR Manager). The Build Guide's tab 15 scenario describes a materially different, richer flow: an automated D-30 case, two independent evaluators (P1/P2) using the FR-HC-01-07 form, a primary Department Head 3B recommendation (the same dept-head definition Perubahan Posisi already uses, not the direct-manager one), and an HR Manager decision that can also approve a linked Perubahan Posisi draft in one action.

Rather than contort the existing simple fields to fit this, added a new `ContractRenewalCase` model that owns the whole automated pipeline end to end, and only touches `Contract` itself at the very end — via the exact same mutation the manual path already used (see below). The old manual fields on `Contract` are untouched and remain valid for a renewal not started by this automated case (e.g. an ad-hoc HR-initiated review).

### Schema: one new table, fully additive

`ContractRenewalCase` (migration `20260803151403_contract_renewal_case_workflow`) plus two new enums (`RenewalRecommendation`: `PERPANJANG_3/6/12`, `TIDAK_DIPERPANJANG`, `MUTASI`, `DEMOSI`; `ContractRenewalCaseStatus`: `TRIGGERED`, `EVALUATION_SENT`, `PENDING_HR_MANAGER`, `RETURNED`, `REJECTED`, `APPROVED`, `CANCELLED`) and one new nullable/unique FK on `MovementRequest` (`renewalCaseId`, reverse of the case's `linkedMovementRequestId`). No existing table altered; verified by reading the generated migration SQL (`CREATE TABLE` only).

Two deliberate leanness choices:
- **Itemized FR-HC-01-07 scores are a JSON blob** (`p1Scores`/`p2Scores`), not ~13 mostly-null columns per evaluator — the form's KPI/Productivity branch and its 5-alternative-criteria branch are mutually exclusive, so most columns would always be empty either way. `computeEvaluationTotal` sums whichever branch was populated; the exact weighting formula is unknown until the real FR-HC-01-07 DOCX is supplied (deferred with the DOCX templates themselves), so the total is a straight sum — documented as a simplification.
- **No stored reminder/escalation timestamps.** This app has no notification-delivery channel at all (DSH-10 is still "Needs Decision" — confirmed by grep, zero hits for any mailer/cron dependency). "Reminders" are implemented the same way every other deadline in this app is (Contract's `computeExpiryUrgency`, Onboarding's `OVERDUE`): computed live from `evaluationDueDate` via `isOverdue()`, surfaced as a badge on the case detail page and in the Approval Inbox — never a persisted "reminder sent" event, since there's no channel to have sent it through.

### D-30 trigger: idempotent, computed on page load (no cron exists)

`triggerDueRenewalCases()` scans `ACTIVE` contracts with no existing case and an `endDate` within 30 days (`isRenewalDue`, mirrors `computeExpiryUrgency`'s `DUE_30` cutoff exactly), called at the top of `/contract-renewals`'s list page — same "derive/act on read" pattern the rest of this app already uses for anything time-based, since there's no scheduler dependency to add one for. `currentContractId`'s unique constraint is the actual idempotency guarantee (a concurrent second load can't double-create); the "no existing case" filter just avoids the wasted round trip on every subsequent load.

### Work calendar: Mon-Fri only, no public holidays

`src/lib/work-calendar.ts`'s `addWorkingDays` is a plain Mon-Fri calculator — no `Holiday`/`WorkingCalendar` table exists anywhere in the schema (the only admin-maintained master lists are `EducationLevel`/`PtkpStatus`), and building one wasn't in scope for "build the workflow." WF-18's "5 working days" and "configurable company work calendar" are satisfied for the weekend case; Indonesian public holidays are a known gap, flagged here rather than silently approximated.

### Dept Head recommendation counts as its own Perubahan Posisi approval (DEC-019), verified live

When the primary Dept Head (Level 3B of the employee's department — reusing `dept-head.ts`/`level3-scope.ts` unchanged) recommends Mutasi/Demosi, `submitDeptHeadRecommendation` creates the linked `MovementRequest` directly at `status: "SUBMITTED"` with `deptHeadDecision*` already populated and a note explaining the auto-satisfaction — skipping `PENDING_DEPT_HEAD` entirely, since re-requiring a separate Dept Head click on the same recommendation would violate "no duplicate Department Head... approval" (WF-17's own note). `proposedEffectiveDate` defaults to the current contract's `endDate + 1 day`, so the Position change takes effect exactly when the new contract would begin.

### HR Manager's combined decision genuinely updates both records in one transaction

`decideRenewalCase` is the one action WF-12/ACC-16 call for: on Approve, it writes the case's decision fields AND (if a linked Mutasi/Demosi draft exists) the `MovementRequest`'s HR-Manager decision fields, in the same `$transaction` — never by calling the standalone `decideMovementRequest` action a second time. If the final recommendation changes away from Mutasi/Demosi, the linked draft is cancelled (never deleted) with `cancellationAuthority: "HR_MANAGER"`; if it changes into Mutasi/Demosi where no draft existed, a new one is created with the Dept-Head-decision fields attributed to the HR Manager's own decision (there's no real Dept Head recommendation to attribute in that edge case) — noted explicitly in both the code comment and the created record's `deptHeadDecisionNote`, same "flag the tension, don't paper over it" practice as Recruitment vs. Movement's differing self-approval bypass rules. A changed recommendation always requires `changeReason` (`requiresChangeReason`); an unchanged one doesn't.

Live-verified end to end (two real test cases, `REN-2026-0001`/`REN-2026-0002`): D-30 trigger fires exactly at the `DUE_30` boundary; HR Admin sends to two distinct evaluators (blocked if the same person is picked twice); each evaluator sees only their own scores, both full evaluations become visible to the Dept Head/HR Manager/HR Admin once submitted; 5-working-day due date computed correctly across a weekend; Dept Head's Mutasi recommendation auto-created `MOV-2026-0007` at `SUBMITTED` with correct evidence; HR Manager's one Approve action flipped **both** the case and `MOV-2026-0007` to Approved simultaneously; contract generation stayed blocked until HR Admin executed the movement via the existing, unchanged `executeMovementRequest`; the new contract (`PKWT/CBP/2026/007`) was created via the same `createRenewalDraftContract` helper the manual path uses, linked via `renewedFromContractId`; the old contract and the employee's prior Assignment both remained intact and unmodified throughout.

### Shared Contract-mutation helper extracted, not duplicated

`nextContractNumber`/`createRenewalDraftContract` moved out of `contracts/actions.ts` into `src/lib/contract-mutations.ts` so both the pre-existing manual "Buat Draf Perpanjangan" button and this new automated path create the next Contract row identically — refactor verified behavior-preserving by re-running the full existing `contract.test.ts` suite (all passing; the manual path's own live behavior was already covered by that suite and by the prior session's live verification when WF-10 was first built, not re-clicked-through again here).

## 2026-08-03 (fix, same day) — Perubahan Posisi: merged picker+form into one page; evaluation reference now collected at submission

Two follow-ups from the user testing the feature directly.

**Routing block from leftover test data.** The user (as Budi) hit "Anda
adalah satu-satunya Kepala Departemen/Manajer (Level 3B) di department
ini" trying to move Agus Setiawan within Produksi. Cause: the "Asisten
Kepala Departemen Produksi" Position created earlier purely to verify the
dept-head mechanism was still assigned to Budi as an Additional
Assignment — making him Produksi's only level-3B holder, which the
self-approval-conflict check correctly (but unhelpfully, since it was
never a real appointment) blocked. Ended that test Assignment via the
existing admin UI (Employee page's "Akhiri Penempatan Non-Utama") —
Produksi is back to zero active level-3B holders, so Budi's own
submissions now succeed and simply wait at `PENDING_DEPT_HEAD`, per the
fix earlier the same day.

**One page instead of two steps.** Combined the employee picker
(`pick-employee-form.tsx`, added earlier the same day) directly into
`submit-movement-form.tsx` — the employee select is now just the form's
first field; choosing one switches which of their Assignments can be
picked as `currentAssignmentId`, entirely client-side (every eligible
employee's Assignment data is preloaded, no extra request). `/movements/new`
always renders this one form now; an `?employeeId=` query param (still
used by the link on an Employee's own detail page) only pre-selects that
employee rather than branching to a different page.

**Evaluation reference moves to the submit form itself.** Previously
`performanceEvaluationRef` was purely an HR-Admin-only field, addable only
after submission — but the person submitting a Promosi is exactly the one
who knows the evaluation exists. Added it directly to the submit form,
required when Jenis Perubahan is Promosi, with a notice that it's a free
text/link placeholder for now ("we will create the evaluation form
later" — Phase 3 Competency & Training scope, not built yet) that will
point at a real Evaluation record once that module exists. The HR-Manager-
approval-time check and HR Admin's own edit form both stay as a safety
net (e.g. for a request HR Admin needs to add/correct it on afterward).
Moved its display out of the confidentiality-gated block on the detail
page too, since it's now one of the requester's own submitted fields, not
an HR-only addition — attendance and confidential notes remain HR-only.

## 2026-08-03 (fix, same day) — Perubahan Posisi had no "add" entry point from its own list page

Reported by the user after logging in as a Level-3 employee (Budi):
"no add button for me to change people in my department." The only way
to reach the submit form was a link on a specific Employee's own detail
page — the Perubahan Posisi list page itself had no equivalent of
Recruitment's "Buat Permintaan Baru" button, so a Level-3 user with no
other reason to be on a particular Employee's page had no way to start
one at all.

Added an "Ajukan Perubahan Posisi" button to the list page (HR Admin, or
anyone holding a Level-3 position anywhere). `/movements/new` now handles
being reached with no `employeeId` yet: it shows a picker
(`pick-employee-form.tsx`) scoped to whoever the viewer can actually
submit for — every employee for HR Admin, or everyone in a department the
viewer holds a Level-3 (3A/3B) Position in (`getLevel3DepartmentIds`,
mirroring the analogous helper already built for the Dept-Head-3B
approver side) — then hands off to the same per-employee form. Live-
verified as Budi: the picker correctly narrows to Produksi's 5 employees
only, not the full company list.

## 2026-08-03 (fix, same day) — Perubahan Posisi: submission was blocked company-wide except in the 2 departments with a level-3B Position

Reported by the user as "no one can add new perubahan posisi." Root cause:
`submitMovementRequest`'s routing check blocked *any* submission whenever
`getDeptHeadApprovers(departmentId).length === 0` — i.e. whenever a
department had no level-3B Position holder at all, not only when the
actual submitter was the sole one. As of this writing only Finance &
Procurement and Produksi have a level-3B Position, so every other
department (Direksi, GA & Legal, Pengembangan Kualitas, SDM &
Pengembangan Organisasi, Teknologi Informasi) was completely unable to
submit, for anyone — an over-generalization of the spec's actual
requirement, which is specifically about the requester being the *only*
Department Head 3B (a self-approval conflict), not about the department
lacking one at all.

Fixed by narrowing the block to that literal case: submission is refused
only when every level-3B holder in the department *is* the submitter
(`deptHeadApprovers.every(a => a.employeeId === session.user.employeeId)`,
only true when that list is non-empty and entirely the submitter). When no
one holds a level-3B Position there yet, the request now submits normally
and simply sits at `PENDING_DEPT_HEAD` until one exists — same accepted,
cancellable-in-the-meantime behavior already documented for Recruitment's
own dept-head gate. Live-verified: HR Admin submitting a Mutasi for an
employee in SDM & Pengembangan Organisasi (zero level-3B Positions there)
now succeeds.

## 2026-08-03 — Movement Request refactored in place into "Perubahan Posisi" (Promosi/Mutasi/Demosi only)

Direct user request, using the real FR-HC-01-09 "Rekomendasi Perubahan
Posisi" form (fetched from Drive) as the field reference: narrow the
existing Movement Request feature to only Promosi/Mutasi/Demosi, add a
Department Head 3B → HR Manager two-stage approval chain (reusing the
exact mechanism just built for Recruitment), add confidentiality, and add
HR-only supporting fields (3-month attendance, evaluation reference,
confidential notes). Explicitly an in-place refactor, not a new module —
`MovementRequest`/`MovementType`/`MovementRequestStatus` keep every
existing value; nothing was renamed or removed at the schema level.

### Nothing destructive — old Rotasi/Perubahan Status rows are frozen, not migrated
`MovementType` still has all 5 values (`ROTATION`/`STATUS_CHANGE` included)
and `MovementRequestStatus` only gained two new values
(`PENDING_DEPT_HEAD`, `RETURNED`) — every pre-existing row (3 in the dev
DB: one cancelled Rotasi, one implemented Mutasi, one implemented Status
Change) survived the migration byte-for-byte. The submit form and server
action now only accept Promosi/Mutasi/Demosi (`isPerubahanPosisiType`,
enforced server-side, not just in the dropdown); the detail page renders
any other type with a "legacy/archived" notice and suppresses every
decision/execute/HR-fields control regardless of status — old records are
inert, not reclassified or force-migrated into the new flow.

### "Level 3" (submit) vs "Level 3B" (Dept Head approval) are different job-level checks
Per direct clarification: any employee holding `Job.jobLevel` "3A" or "3B"
(`src/lib/level3-scope.ts`) may submit — scoped to their own Department
(resolved by walking `OrgUnit.parentUnit` up to the nearest DEPARTMENT-tier
ancestor, since a Position can sit under a Section). The Dept Head
approval stage is still literally "3B" only, reusing
`src/lib/dept-head.ts` from the Recruitment work unchanged.

### The Dept Head 3B gate never bypasses — unlike Recruitment's
Recruitment's dept-head gate skips straight to the HR Manager when the
requester already holds that authority (nobody else needs to review their
own call). Perubahan Posisi explicitly forbids that: "do not silently
self-approve or skip the stage." Every new request always starts at
`PENDING_DEPT_HEAD`. Two routing checks run at submit time
(`getDeptHeadApprovers`, extended in `dept-head.ts`): if literally no one
holds a level-3B Position in the department, or if the only holder is the
person actually submitting, the request is blocked outright with a
routing-configuration error rather than created in an unroutable state.
Separately, `isSelfApprovalAttempt` blocks a decision (at either stage) by
whoever is recorded as the request's own `requesterEmployeeId`, even if
they otherwise hold a qualifying Position — this is requester-keyed, not
employee-being-changed-keyed, since "prevent self-approval" is about not
rubber-stamping your own ask.

### `currentAssignmentId` replaces re-deriving "the Primary" at execution time
The request now stores exactly which Assignment it identified at
submission (required going forward, nullable only because pre-refactor
rows predate it) — execution ends that specific Assignment, re-validating
it's still ACTIVE, instead of re-querying "whichever Assignment is
currently Primary" (which could have changed in between). Falls back to
the old re-derivation only for a legacy row with no stored
`currentAssignmentId`.

### Confidentiality: HR-only fields are a separate field set, not a split decisionNote
Attendance counts, evaluation reference, and `hrConfidentialNotes` are new
fields, editable only by HR Admin (`updateMovementHrFields`) and rendered
only for HR Admin/HR Manager/the deciding Dept Head 3B — never the
requester or the affected employee. `decisionNote`/`deptHeadDecisionNote`
(the return/reject reason) stay visible to everyone once the request has
actually been Returned/Rejected, since that's their entire purpose —
splitting them into a second "confidential" field would only obscure
feedback the requester needs to act on.

### Live-verified end to end
Produksi initially had no level-3B Position at all — reproduced the
"no eligible approver" routing error live as Budi (Kepala Seksi Produksi,
3A) attempting to submit for himself. Created a real level-3B Position
("Asisten Kepala Departemen Produksi", reporting to Kepala Departemen
Produksi — matching FR-HC-01-09's own "Asst. Dept. Head" approval line)
via the existing admin UI and granted it to Budi as an Additional
Assignment (Primary role untouched). Verified the full chain with HR Admin
submitting a Promosi for Rendra Wicaksono (2A → vacant Kepala Departemen
Produksi, level 4): blocked with "evaluation required" until HR Admin
filled in the HR-only fields, Budi approved as Dept Head, Made approved as
HR Manager, HR Admin executed — Rendra's old Assignment end-dated, new one
created, full history intact. Confirmed the legacy STATUS_CHANGE row
(MOV-2026-0003) renders as a read-only archive with no action controls.

## 2026-07-30 — Department Manager/Head (Job level 3B) approval gate added ahead of the HR Manager for Recruitment Requests

Direct user request: "every Recruitment Request form (FR-HC-01-01) need
approval of manager/dept head (level 3B) before it goes to HC manager for
approval." This amends the Build Guide's WF-15/DEC-016, both previously
"Confirmed"/"Decided" as "HR Manager alone approves, returns or rejects
Recruitment Requests" — the Drive connector is read-only in this session,
so the Build Guide's own Decision Log tab still needs the user to record
this change there; this file is the durable record until then.

Two points needed clarifying before implementation, both resolved directly
with the user rather than assumed:
- **Who is "manager/dept head"**: literally whoever holds a Job graded
  level "3B" — not the requester's reporting-line manager (the mechanism
  Movement/Contract-renewal already use) and not an OrgUnit's structural
  head. Confirmed after showing that only Finance & Procurement's "Manager
  FP" is actually graded 3B in the current org data — Produksi's own dept
  head ("Kepala Departemen Produksi") is graded level 4, and Direksi/SDM/IT
  have no level-3B role at all. The user confirmed they'll create a
  level-3B position in each department themselves (existing Position UI,
  no code needed) rather than have the rule fall back to a structural
  check — so a request from a department with no level-3B position filled
  will sit at Pending Dept Head with no eligible approver until one exists.
- **Self-approval**: if the requester's own current Position is already
  level 3B in the request's own department, the gate is skipped entirely
  (status goes straight to Submitted/HR-Manager-queue) — there's no one
  else in that capacity to approve on their behalf.

### Implementation
Same "distinct status per stage" pattern this codebase already uses for
Contract renewal (`REVIEW_REQUESTED` → `RECOMMENDATION_SUBMITTED` → HR
Manager decision), not a side-channel field on top of the existing status:
new `PENDING_DEPT_HEAD` status ahead of `SUBMITTED`, with its own decision
-evidence fields (`deptHeadDecisionAt/ByAccountId/PositionId/Note`) kept
separate from the HR Manager's own `approvedAt/approvedByAccountId/
decisionPositionId/decisionNote` — both trails survive independently, e.g.
a request rejected at the dept-head stage vs. the HR Manager stage remains
distinguishable. New `src/lib/dept-head.ts` (`getActiveDeptHeadPositions`,
`getDeptHeadDepartmentIds`) mirrors `hr-manager.ts`'s live Assignment
-resolution pattern, just filtered on `Job.jobLevel === "3B"` and scoped to
one department (or all departments, for the personal inbox) instead of a
`grantsHrManagerAccess` Position flag. `decideRecruitmentRequestAsDeptHead`
mirrors `decideRecruitmentRequest`'s shape exactly (Approve →
`SUBMITTED`, unblocking the HR Manager's queue; Reject/Return →
`REJECTED`/`RETURNED` directly, same outcome as if the HR Manager had
decided). The HR Manager's own decision flow (Jabatan-at-approval, review,
etc.) is completely unchanged — it only now starts one step later.

### Access-check and nav-link widening follow the same pattern as the earlier HR Manager fix
`recruitment/[id]/page.tsx`'s access gate and `approvals/page.tsx`'s
personal inbox both needed widening to also admit a dept-head-only user
(not HR Admin, not HR Manager, not the request's own submitter) —
otherwise this feature would be unreachable for exactly the persona it's
built for, repeating the same class of gap fixed earlier today for HR
Manager (see the recruitment-detail-access-bug memory). `approvals/page.tsx`
now serves both personas in one inbox (a new section scoped to whichever
departments the caller holds a level-3B Position in, alongside the
existing HR-Manager section) rather than a separate page. The `/approvals`
nav link in `layout.tsx` was also split out from the `isHrManagerNow`-only
block it shared with `/my-positions`/`/hr-dashboard`/`/hr-reports`, since
those three do stay HR-Manager-exclusive but `/approvals` no longer is.

Live-verified end to end: a Finance & Procurement request sits at Pending
Dept Head until Siti (Manager FP, level 3B) approves it from her own
approvals-inbox section; it then appears in Made's (HR Manager) queue and
approves normally with the Jabatan-at-approval step intact, both decision
trails shown together on the request detail page. Separately verified a
Produksi request (no level-3B position there yet) sits unroutable at
Pending Dept Head as expected, and that a self-submitted request from Siti
(already level 3B in her own department) skips the gate entirely.

## 2026-07-30 — Jabatan removed from the Recruitment Request submit form; set by the HR Manager at Approve time instead

Direct user request: "Take out Jabatan from Formulir Permintaan Tenaga
Kerja Baru (FR-HC-01-01)". `jobId` was required on submit and used later
to filter candidate Positions when creating the Employee from an approved
request, so removing it needed a decision on where that link would still
come from. Presented three options; the user picked "keep it in the data
model, just hide it from requesters" — HR Admin/Manager sets Job as part
of the Approve decision, not the original requester.

Implementation: `RecruitmentRequest.jobId`/`job` made nullable (migration
`20260730073159_recruitment_job_nullable_set_at_approval`, a standard
SQLite table-rebuild, no data loss). The Jabatan `<select>` was removed
from `recruitment/new/create-request-form.tsx`; `decideRecruitmentRequest`
now reads `jobId` from the Approve form and requires it only when
`decision === "APPROVED"` (Reject/Return don't need it).
`createEmployeeFromRecruitmentRequest` and the create-employee page guard
against a request that reached Approved without a Job somehow set. All
read surfaces (list, approvals inbox, request detail) render `job?.jobTitle
?? "—"` for the window between submission and approval where it's still
null.

### Same change surfaced a real access-control bug in the request detail page
While re-verifying the "HR Manager can't approve" complaint that came in in the same
message, found that `recruitment/[id]/page.tsx`'s access gate only allowed
`isHrAdmin(session) || isOwnRequest` — an HR Manager who is not also HR
Admin and not the request's own submitter got a hard access-denied page,
never even reaching the Approve/Reject/Return buttons. `movements/[id]/page.tsx`
already had the correct pattern (`isHrAdmin || isHrManagerNow || isOwnRequest`,
computed from `getActiveHrManagerPositions`); recruitment's page was
missing the `isHrManagerNow` branch. Fixed by reordering so
`hrManagerPositions` is computed before the gate and adding it to the
condition, matching movements. This was very likely the actual cause of
"HR manager can not approved new permintaan tenaga kerja baru" — reproduced
live with `made.wirawan@cbp.demo` (HR Manager, not HR Admin) against
someone else's request before the fix (access denied) and after (approved
successfully, Jabatan select appeared and worked).

## 2026-07-30 — Contract + renewal pipeline (WF-10, LIF-08..12, Data Fields Blueprint "08 Contracts")

Next Phase 2 increment: LIF-08..12/WF-10 is the one remaining "Not Reviewed"
Phase 2 row the review checklist lists right after Onboarding/Movement
("Build after the Recruitment and onboarding continuation point; keep
decision and execution permissions separate"). Offboarding is the last
piece left.

### One Contract model, no separate renewal-case dataset
The Data Fields Blueprint's "08 Contracts" is the *only* dataset here —
there's no separate "Renewal Case" entity, and its own fields
(`drafted_at`/`released_at`/`signed_at`) are the only place WF-10's 9-state
pipeline could live. Decision: a single `Contract.status` enum plays two
roles depending on where a row sits in the pipeline — (1) an existing
ACTIVE contract nearing its own `end_date` moves through
`REVIEW_REQUESTED` → `RECOMMENDATION_SUBMITTED` → `APPROVED_FOR_RENEWAL`/
`NOT_RENEWED`; (2) once approved, a **new** Contract row (linked via
`renewedFromContractId`) moves `DRAFT` → `RELEASED` → `SIGNED` → `ACTIVE`,
at which point the old row flips to `ENDED`. "Old/new history remains"
(WF-12) falls out naturally — nothing is ever overwritten, only new rows
created and old ones' status changed, same discipline as Assignment's
close-old/open-new pattern.

### Approval-evidence fields not in the blueprint, added per WF-02
The Contract dataset's own field list has no recommendation/decision
fields at all (only 11 thin fields, several already "Missing" in the
blueprint). WF-02's general rule — "record requester, submission date,
approver, approver Position, approval date, decision, comments" — applies
to every approval workflow in this app, so `recommendationByEmployeeId`/
`recommendationByPositionId`/`recommendationNote` and
`decisionByAccountId`/`decisionPositionId`/`decisionNote` were added,
mirroring Recruitment's and Movement's own fields exactly rather than
inventing a third shape for the same evidence.

### Draft/Release/Sign/Activate have no actor field — the audit log covers it
Unlike the recommendation/decision steps, `draftedAt`/`releasedAt`/
`signedAt`/`activatedAt` have no accompanying "by" foreign key — matching
the blueprint's own thin field set here (it lists only the timestamp, not
an actor, for these three). The audit log (CTL-01) already records who
performed each action; adding redundant actor FKs for steps the blueprint
itself doesn't ask for would be speculative.

### Baseline contract creation is direct, not a renewal
HR Admin can create a brand-new Contract for any existing Employee
directly (`/contracts/new?employeeId=...`, reached from a "Buat Kontrak"
link on the Employee page) — goes straight to `ACTIVE`, since there's no
renewal process for a first-ever contract entry. Only a Contract *already
ACTIVE and nearing its own end date* can enter the WF-10 renewal pipeline.
This intentionally does **not** hook into Employee creation the way
Onboarding does — retrofitting the employee-creation forms to also collect
contract end dates was judged out of scope for this increment; HR Admin
establishes the baseline contract as a small separate step instead.

### Expiry urgency computed live, never stored (LIF-10)
`computeExpiryUrgency()` (`src/lib/contract.ts`, unit tested) derives the
90/60/30/7-day reminder thresholds plus an Expired state from `status` +
`endDate` on every read — same "derive live, never cache" principle as
Onboarding's `overall_status`, HR Manager access, and the org chart. No
actual notifications are sent (DSH-10, "Notification channel," is still
"Needs Decision" — unchanged from earlier phases); this only drives the
list/detail page's urgency badge.

### `source_evaluation_id`, `candidate_id`-adjacent fields not modeled
Same reasoning as Movement Request's and Onboarding's own deferrals —
`source_evaluation_id` references Evaluation Results, which doesn't exist
in this app yet (Phase 3).

### A real visibility bug caught and fixed during live verification
The first implementation's `canViewContract(session, employeeId)` only
allowed HR Admin or the employee themselves — which meant neither the
Department Manager (who must view the contract to submit a recommendation)
nor the active HR Manager (who must view it to decide) could actually reach
the detail page they needed to act on. Caught live: logging in as the HR
Manager to decide the contract's renewal produced `common.accessDenied`
instead of the decision buttons. Fixed by adding
`canViewContractDetail()`, a wider check used only on the detail page
(the Employee-profile contract list summary still uses the narrower
`canViewContract`). Verified live afterward: HR Manager could view and
decide; a Department Manager (Budi, recommending on his own report) could
too.

### Verified live end-to-end, both branches
Renew path: created a baseline contract for Siti, started review,
Budi (her manager) recommended Renew, HR Manager (Made) approved with
`decisionPositionId` recorded, HR Admin drafted/released the renewal,
Siti signed her own contract (self-only, confirmed HR Admin cannot sign on
her behalf), HR Admin activated it — confirmed the old contract flipped to
`ENDED` with a forward link to the new one, and the new one is `ACTIVE`
with a backward link, `Employee.employmentStatus` synced. Not-Renew path:
created a second baseline contract for Budi, recommended Not Renew,
HR Manager decided Not Renew with a reason — confirmed the contract lands
in the `NOT_RENEWED` terminal state with no further action buttons (no
draft/release/sign/activate offered). Per LIF-12, the reason is recorded
but no actual offboarding handoff is created — Offboarding doesn't exist
yet in this app; revisit when it does. 16 new unit tests
(`contract.test.ts`, plus `permissions.test.ts` additions); 90 tests total
across 8 files, clean `tsc`/`eslint`.

### Migration
`20260730035218_contract_renewal_wf10` — purely additive (one new model,
two new enums, back-relations on Employee/Account/Position/FileObject). No
existing data touched.

## 2026-07-29 — Onboarding Case (LIF-03, Data Fields Blueprint "12 Onboarding")

Next Phase 2 increment after Movement: the Build Guide's own "15 In-App
Review" checklist bundles "Employee creation, request fulfillment,
onboarding and movement" into one Phase 2 row (still "Not Reviewed") with
the note "Continue here after the Recruitment role correction; reuse
Phase 1 Employee and Assignment models" — direct creation, fulfillment, and
Movement were already done, so Onboarding was the remaining piece of that
row.

### Created automatically alongside every new Employee, never a separate step
LIF-03: "After Employee creation, HR Admin coordinates tasks... reuse the
Employee and initial Position Assignment; do not re-enter identity data."
Wired an `OnboardingCase` creation into the same transaction as both
Employee-creation paths: direct creation (`employees/actions.ts`'s
`createEmployee`, now transactional where it previously wasn't) and
Recruitment fulfillment (`recruitment/actions.ts`'s
`createEmployeeFromRecruitmentRequest`, extending its existing
transaction). `plannedStartDate` defaults to `hireDate` — no separate date
entry. Verified live: creating a direct Employee produced `ONB-2026-0001`
automatically with no extra action needed.

### Three completion flags, each with the blueprint's own Primary Owner
Modeled `contractComplete`/`mandatoryMaterialComplete`/`assetsComplete`
exactly as the blueprint's three booleans, each owned by a different admin
type (People & Payroll / Training / Assets) per its Primary Owner column,
plus HR Admin as universal owner (consistent with HR Admin's broader
operational latitude elsewhere in this app). **Deliberately manual, not
system-derived**: the blueprint ties these booleans to Contracts/Training
Assignments/Asset Assignments, none of which exist yet in this app
(Contract Renewal is still unbuilt Phase 2; Training is Phase 3; Assets is
Phase 4) — building automatic derivation now would mean stub-linking to
nonexistent systems. HR/Training/Assets Admin mark each flag directly,
matching LIF-03's own framing ("HR Admin coordinates tasks... and
responsible owners", not "the system detects completion"). Revisit once
those underlying systems exist.

### `candidate_id`, `asset_requirement_profile` deliberately not modeled
Same reasoning as Movement Request's deferred Evaluation/Competency
fields — these reference Candidate and Asset-catalog datasets that don't
exist in this app yet.

### overall_status computed live, never stored
`computeOnboardingStatus()` (`src/lib/onboarding.ts`, unit tested) derives
Not Started / In Progress / Overdue / Complete from the three flags plus
`plannedStartDate`/`mandatoryMaterialDueDate` on every read — same
"derive live, never cache" principle as HR Manager access and the org
chart. `completedAt` is set/cleared automatically the moment all three
flags become true/false — verified live: marking all three complete moved
the case to "Selesai" with a `completedAt` timestamp; un-marking one flag
reverted it to "Sedang Berjalan" with `completedAt` cleared again, no stale
"complete" state left behind.

### Visibility: "Admin shared", not self-view — unlike Employee Master
The blueprint's Visibility column says "Admin shared" for every Onboarding
field, distinct from Employee Master's self-view pattern. `canViewOnboarding()`
allows HR/Training/GA Admin and the active HR Manager (ACC-15/DSH-13: "HR
Manager sees onboarding progress... in personal dashboard") but not the
employee being onboarded themselves. Verified live: a plain employee
account gets `common.accessDenied` on `/onboarding` and the nav item is
hidden; GA Admin can only toggle the Assets flag (Contract/Training render
as a plain read-only "Selesai"/"Belum Selesai" label, not an inert
action-styled button — a UI clarity bug caught and fixed during this same
verification pass, where the read-only label had reused the actionable
button's verb-phrase text).

### Migration
`20260729084513_onboarding_case_lif03` — purely additive (one new model,
one new enum, back-relations on Employee/Account). No existing Phase 0/1/2
data touched.

## 2026-07-29 — Reviewed future-phase filtering/import-export requirements; no existing code changed

The user updated the Build Guide's "15 In-App Review" tab with much more
detailed acceptance criteria, including search/filter/import/export
specifics for Phase 3 (Competency, Training), Phase 4 (Assets), and Phase 5
(Performance, Salary-slip, Attendance, GA requests) datasets, plus richer
detail on Phase 2's own rows (e.g. Recruitment: "searches request number,
Job, Department and requester; filters status, date, Position and
fulfilment; supports combined filters, clear/reset, no-result and
pagination persistence... Export contains only the permitted filtered
rows"). Per explicit instruction, **nothing already built was changed** —
this is reviewed and recorded here for a future increment, not
retrofitted now:

- Phase 3/4/5 rows are all "Not Reviewed"/future-phase and describe
  datasets that don't exist in this app yet (Competency Dictionary,
  Training Catalogue, Asset Master, Performance cycles, Salary Slips,
  Attendance, GA Requests) — nothing to build until those phases start.
- The Phase 2 rows' expanded filter/search/export detail (multi-field
  search, combined-filter UI with clear/reset, pagination persistence,
  filtered exports scoped to the visible rows) goes beyond the single-field
  status/department filters added earlier today to Employees, Audit Log,
  Recruitment, and Movements (see the "List filtering" entry below). That
  richer filter UX, plus a genuine filtered-export capability tying into
  the existing CTL-13 import/export framework, is noted here as a defined
  future increment rather than expanded now, per instruction not to change
  what's already built.
- Every future-phase row explicitly states its dataset's import
  restrictions (e.g. "Recruitment Request import is not available",
  "Fulfilment, onboarding and movement workflows cannot be imported",
  "Routine renewal decisions cannot be imported") — worth remembering when
  those phases start, since it means CTL-13's "universal import" framework
  does NOT apply uniformly to every dataset; several are export/filter-only
  by explicit design.

## 2026-07-29 — List filtering added where usage revealed a real need

Not tied to a specific Build Guide row — added on direct request ("put in
filtering where you think is necessary") after the Audit Log's hard `take:
100` was found silently truncating 211 real rows with no indication more
existed. Added URL-searchParams-based filters (plain `<form>` with no JS —
consistent with this app's server-component-first style, and the filtered
view is a shareable/bookmarkable URL) to the four list pages that will
genuinely accumulate rows in production:
- **Employees** (`/employees`): search (employeeNumber/fullLegalName/
  preferredName, `contains`), department, employment status, active/inactive.
- **Audit Log** (`/audit-log`): action, dataset (populated from a live
  `distinct` query so it always reflects real data, not a hand-maintained
  list), actor, date range. Now also shows "Menampilkan X dari Y" so a
  truncated view is visible instead of silent.
- **Recruitment** (`/recruitment`) and **Movements** (`/movements`): status,
  plus department (Recruitment) or movement type (Movements).
Filters are additive to each page's existing visibility scoping (a plain
employee still only ever sees their own Recruitment/Movement rows — the
filter narrows within that scope, never widens it). The Org Chart already
had its own department-filter/search from Phase 1 (ORG-10) — not
duplicated. Admin lookup lists (Positions/Jobs/Org Units) and the Import
batch history were left unfiltered — small, infrequently-browsed lists
where a filter bar would be overhead, not help.

## 2026-07-29 — Movement Request (LIF-04, Data Fields Blueprint "28 Movement Requests")

Phase 2's next increment after the HR Manager access correction: LIF-04 is
the only remaining Phase 2 lifecycle row marked **P0** (Onboarding,
Contract Renewal, and Offboarding are all P1) and its mechanics reuse the
existing Assignment model directly, so it was the natural next slice —
"reuse the Phase 1 Assignment model; do not rebuild it."

### A formal request/decision/execution flow, alongside the existing direct action
LIF-04: "An authorized manager submits or recommends promotion/transfer. HR
Manager approves or rejects the movement. HR Admin executes the future/
effective-dated Position Assignment." The existing "Pindahkan ke Posisi
Baru" panel on the Employee page (Phase 1) executes immediately with no
approval step — kept as-is rather than removed, on the same direct-vs-
formal-request precedent as DEC-014 (Employee creation stays valid without a
Recruitment Request). The new `MovementRequest` model adds the formal path
Build Guide requires HR Manager decisions to gate. Whether the direct path
should eventually require the same gate is an open question for a future
pass, not decided here.

### Schema fields sourced from the Data Fields Blueprint's "Movement Requests" dataset
Modeled `movement_request_id` → `requestNumber` (`MOV-{year}-{seq}`,
matching Recruitment's `REQ-` convention), `employee_id`, `movement_type`
(`PROMOTION`/`ROTATION`/`MUTATION`/`DEMOTION`/`STATUS_CHANGE` — the
blueprint's exact 5 dropdown values), `current_position_id` (a snapshot
taken at submission time — the employee's actual current position could
change before decision/execution), `proposed_position_id`,
`proposed_effective_date`, `request_reason`, and `approval_status`
(`SUBMITTED`/`APPROVED`/`REJECTED`/`IMPLEMENTED`/`CANCELLED` — note: no
"Returned" state, unlike Recruitment's fuller WF-13 machine; the blueprint
lists exactly these five). **Deliberately not modeled**:
`source_evaluation_id`, `competency_readiness_percent`,
`attendance_summary`, `training_readiness` — these reference
Evaluation/Competency/Attendance/Training datasets that don't exist yet in
this app (Phase 3/5). Adding stub FKs to nonexistent datasets now would be
speculative; revisit when those phases start.

### STATUS_CHANGE is the one type that doesn't move a Position
The blueprint's `movement_type` dropdown includes "Status Change" (e.g. a
PKWT→PKWTT conversion) alongside the four Position-changing types, but
defines no separate "proposed employment status" field. Rather than leave
that dropdown option meaningless, added `proposedEmploymentStatus
EmploymentStatus?` (reusing the existing enum, no new modeling) and made
`proposedPositionId` required for every type — for STATUS_CHANGE the
create form locks it to the employee's current Position (disabled `<select>`
+ hidden input pattern) since there's nothing to propose there.
`validateProposedPosition()` (`src/lib/movement.ts`, unit tested) enforces
the inverse rule for every other type: the proposed Position must actually
differ from the current one. Execution (`executeMovementRequest`) skips the
Assignment close-old/open-new step entirely for STATUS_CHANGE and only
updates `Employee.employmentStatus` — verified live: approved and executed
a STATUS_CHANGE request for Budi (PKWTT → PKWT) and confirmed no new
Assignment row was created, only the employmentStatus field changed.

### Decision authority: same HR-Manager-Position-derived pattern as Recruitment, reused not duplicated
`canApproveMovementRequest()` and `canExecuteMovementRequest()`
(`permissions.ts`) call the same `isHrManager()`/`isHrAdmin()` primitives
Recruitment already established — HR Manager alone approves/rejects
(WF-15's principle applied here too, even though LIF-04 doesn't restate it
as explicitly), HR Admin alone executes. `decisionPositionId` is captured
the same way (hidden field when the HR Manager holds exactly one qualifying
Position, a `<select>` when they hold more). Cancellation reuses the exact
same `CancellationAuthority` enum and Requester-or-HR-Manager-or-HR-Admin
rule as Recruitment's DM-25 — Movement's blueprint doesn't spell out
cancellation authority the way DM-25 does for Recruitment, but applying the
same rule keeps the app's cancellation model consistent everywhere rather
than inventing a second one.

### "Authorized manager" is the employee's direct manager, resolved fresh — not a stored flag
Added `src/lib/manager-scope.ts`'s `isDirectManagerOfEmployee()`: true only
when the target employee's `currentPosition.reportsToPositionId` equals the
candidate manager's own `currentPositionId`. Same "derive live, never
cache" principle as HR Manager access — a manager's authority to submit for
a specific employee is checked fresh against current Position data, not a
remembered relationship. HR Admin can also submit directly (mirrors its
existing latitude to create Employees directly), and the create-request
form gives HR Admin the same explicit "Diajukan Oleh" employee-picker
Recruitment's form already has — **a bug caught during live testing**: the
first implementation defaulted an HR-Admin-submitted request's
`requesterEmployeeId` to the *target* employee whenever
`session.user.employeeId` was null (HR Admin accounts have no linked
Employee), which silently mislabeled every HR-Admin-submitted request as
"requested by the person being moved." Fixed by requiring an explicit
`requesterEmployeeId` from the form (mirroring Recruitment's pattern
exactly) instead of falling back to the target employee.

### Approval Inbox extended, not duplicated
`/approvals` (built for Recruitment in the HR Manager increment) now shows
a second section for pending Movement Requests, since DSH-04's "HR Manager
personal dashboard shows pending approvals" is written generically, not
Recruitment-specific. Same scoping rule: visible to whoever currently holds
an active HR Manager Position.

### Verified live end-to-end
Submitted MOV-2026-0002 (Mutation, Siti → vacant "Manager FP" seat) as HR
Admin with Budi as requester, approved as HR Manager (Made) with
`decisionPositionId` auto-populated, executed as HR Admin — confirmed
Siti's Assignment history shows the old Primary closed and the new one
opened, nothing overwritten. Submitted, approved, and executed a
STATUS_CHANGE request for Budi (see above). Confirmed HR Admin sees no
approve/reject controls on a Submitted request (only Cancel) and that
attempting the position-occupancy check correctly blocks a move into an
already-Filled Position. Cancelled a test request (wrong-requester-bug
artifact) and confirmed `cancellationAuthority: HR_ADMIN` recorded
correctly. 12 new unit tests (`movement.test.ts`, `permissions.test.ts`
additions); 67 tests total across 6 files, clean `tsc` and `eslint`.

### Migration
`20260729072950_movement_request_lif04` — purely additive (one new model,
two new enums, back-relations on Employee/Position/Account/Assignment). No
existing Phase 0/1/2 data touched.

## 2026-07-29 — Recruitment Request field correction: Shift simplified to two options

The Shift dropdown on the FR-HC-01-01 form (`recruitment/new`) was reduced
from four values (`SHIFT_1`/`SHIFT_2`/`SHIFT_3`/`NON_SHIFT`) to two
(`SHIFT`/`NON_SHIFT`) per direct user correction. No migration was needed —
Prisma represents enums on SQLite as plain `TEXT` columns with no `CHECK`
constraint, so narrowing the set of allowed values is purely an
application/TypeScript-level change (confirmed by inspecting the generated
migration SQL for the original `shiftCode` column: `"shiftCode" TEXT NOT
NULL`, no enum constraint). All existing Recruitment Requests were already
`NON_SHIFT`, so nothing needed backfilling.

## 2026-07-29 — HR Manager persona and corrected recruitment access model (ACC-14..16, WF-15, DM-25, DEC-004/015/016/018)

The Build Guide was updated with a correction: the earlier Recruitment
checkpoint let HR Admin approve/reject/return requests
(`canApproveRecruitmentRequest = isHrAdmin`). The corrected model requires
decision authority to belong exclusively to whoever currently holds an
active **HR Manager Position** — a personal, Position-derived persona, not
HR Admin and not a shared login. This pass corrects that access model and
adds the HR Manager workspace, without touching Phase 0/1 data or starting
onboarding/contract-renewal/movement/offboarding (explicitly deferred).

### HR Manager authority is a Position flag, not a stored role — checked live, never cached
Added `Position.grantsHrManagerAccess` (boolean, additive migration). An
Employee derives HR Manager authority from holding any **ACTIVE** Assignment
(any type — Primary, Additional, Acting, or Temporary; ACC-14 doesn't
restrict to Primary) to a flagged Position, evaluated against the
Assignment's effective-dated range at request time
(`src/lib/hr-manager.ts`'s `getActiveHrManagerPositions()`, same half-open
`effectiveFrom <= now < effectiveTo` convention as `org-chart.ts`). This is
deliberately **not** baked into the JWT/session the way `AppRole` is —
`AppRole` roles are copied from the token into the session on every request
without re-querying the database (see `auth.config.ts`'s `session` callback),
which would leave stale HR Manager access until the next login if we reused
that mechanism. Instead every page/action that needs the check calls
`getActiveHrManagerPositions()` fresh, so access starts and ends exactly on
the Assignment's effective dates with no separate revoke step — verified
live: moved the demo HR Manager (Made Wirawan) off the flagged Position via
the existing Movement action, confirmed his HR Manager nav items disappeared
immediately on next login and `/approvals` 403'd server-side even by direct
URL, then moved him back (Movement's own history-preserving behavior meant
this created a third Assignment row, not a mutation of the first two —
demonstrated DM-10 "never overwrite" as a side effect of the test).

### `permissions.ts` predicates now take resolved position ids, not a session
`canApproveRecruitmentRequest` changed signature from `(session)` to
`(activeHrManagerPositionIds: string[])` — keeps the file dependency-free
(no Prisma import) by pushing the live DB lookup to callers
(`hr-manager.ts`, Node-only, same split rationale as `require-session.ts`)
and passing already-resolved data in, the same pattern `projectEmployee`
already used. Added `isHrManager()` and `canCancelRecruitmentRequest()`
alongside it; all three are unit tested with plain arrays/mock sessions.

### WF-05/ACC-14: which Position decided is recorded, not just who
An Employee can hold multiple Positions concurrently, and ACC-14 requires
storing which one gave authority for a given approval. Added
`RecruitmentRequest.decisionPositionId`. The decision form
(`decision-forms.tsx`) sends it as a hidden field when the HR Manager holds
exactly one qualifying Position, or a `<select>` when they hold more than
one — verified live: Made (single HR Manager Position) approved
REQ-2026-0003 and the record correctly shows "Posisi HR Manager yang
Digunakan: HR Manager (POS-SDM-HRMANAGER-01)" with no user interaction
needed to pick it.

### DM-25 cancellation: the explicit exception to "HR Manager alone decides"
Added `cancelRecruitmentRequest()` plus `RecruitmentRequest.cancelledAt`/
`cancelledByAccountId`/`cancelledByEmployeeId`/`cancellationAuthority`
(new `CancellationAuthority` enum: `REQUESTER`/`HR_MANAGER`/`HR_ADMIN`)/
`cancellationReason`/`previousStatus`. `canCancelRecruitmentRequest()`
allows the original Requester, an active HR Manager, or HR Admin;
`canCancelRequestStatus()` (`recruitment.ts`, unit tested) blocks
Filled/Closed/already-Cancelled per DM-25's explicit note. The request row
is never deleted and existing `RecruitmentRequestFulfillment` links are
never touched — a cancelled-after-partially-filled request keeps its linked
Employees/Assignments, only the remaining unfilled headcount is abandoned.
Verified live: HR Admin cancelled REQ-2026-0003 (status: Approved →
Cancelled, `cancellationAuthority: HR_ADMIN`, reason recorded, "Buat
Karyawan dari Permintaan Ini" correctly disappears), and confirmed a Filled
request (REQ-2026-0001) shows no cancel control at all.

### HR Manager workspace: five routes, two left intentionally empty
Per the explicit instruction to keep the dashboard and reports empty until a
later increment: `/my-positions` (every active Assignment this employee
holds, with a badge on any that grants HR Manager access — reuses the same
live Assignment query pattern as the org chart, not a cached list),
`/approvals` (Recruitment Requests in Submitted/Under Review, scoped to
whoever currently has HR Manager authority — no department scoping yet,
since ACC-13's department-scoped "Assistant/Department Head" submission
isn't built), `/hr-dashboard` and `/hr-reports` (placeholder pages, gated by
the same live check, existing only to reserve the route and prove the access
gate works before content is built). `/profile` (existing from Phase 0) is
reused for "My Profile" rather than duplicated. All four new routes 403
server-side for a non-HR-Manager even with the URL typed directly, not just
hidden from nav — verified live.

### HR Admin position in the model: unchanged mechanism, corrected scope
HR Admin (`isHrAdmin`, `AccountRole.HR_ADMIN`) remains exactly what it was —
a separate operational `Account` with no Employee link required (ACC-01/02).
What changed is which recruitment actions it's allowed to call:
approve/reject/return moved to HR-Manager-only; create-Employee-from-request
stays HR-Admin-only (ACC-13: only after HR Manager approval, enforced
because that action already requires an Approved-or-later status); direct
Employee creation with no Recruitment Request stays HR-Admin-only (DEC-014,
unaffected); cancellation is newly available to HR Admin per the ACC-16
"explicit exception" note.

### Demo data: one new seeded Position/Job/Employee/Account, additive only
`prisma/seed.ts` gained `POS-SDM-HRMANAGER-01` (`grantsHrManagerAccess:
true`, reports to the Director, same tier as the Production Department
Head), Job "HR Manager", Employee "Made Wirawan" (CBP-0003 — the prototype's
own HR Manager persona reference, rebuilt on the real Position-based access
model instead of its flat `roles: ["employee","hr_manager"]` array), and
account `made.wirawan@cbp.demo` — a personal login like every other
employee account, no shared/generic HR Manager credential. Self-healing
upsert pattern (same as the Director-layer fix): if the Position already
existed from a prior seed run without the flag, it's explicitly set rather
than left alone by `update: {}`. No existing Phase 0/1 rows were modified or
deleted.

### Migration
`20260729053419_hr_manager_position_access_and_cancellation` — purely
additive (one boolean column, one nullable FK, six nullable cancellation
columns, one new enum). Applied via `prisma migrate dev` with no data-loss
warning; existing REQ-2026-0001 (already Filled from the prior checkpoint)
is untouched and simply has null values for all the new columns, which is
correct — it was decided under the old HR-Admin-approves model and isn't
retroactively rewritten.

## 2026-07-29 — Phase 2 simplified Recruitment Request (DEC-013, DM-21..23, WF-13/14)

Scope: only the simplified flow explicitly requested — Recruitment Request →
approval → Create Employee → initial Primary Assignment → link back to the
request. Manpower module, Candidate module, and Selected Person module are
explicitly out of scope for this increment (per the user's own instruction),
even though they appear elsewhere in the Phase 2 Build Plan row.

### Fields sourced from FR-HC-01-01, not just the Data Fields Blueprint
The Blueprint's DM-21/22 rows list field names and types but the physical
paper form "Formulir Permintaan Tenaga Kerja Baru" (FR-HC-01-01, fetched
directly from Google Docs per SRC-07) has the authoritative option lists and
Indonesian labels (e.g. exact wording for `reasonCode`, the specific
education/experience/age bands). `src/lib/i18n/id.ts`'s new recruitment
dictionaries were transcribed to match the form's wording, not re-invented.

### Two-model design: `RecruitmentRequest` + `RecruitmentRequestFulfillment`
A request can ask for more than one headcount (DM-23), and each seat filled
needs its own Employee + Assignment pair. Rather than a single
request-to-employee foreign key, `RecruitmentRequestFulfillment` is a join
row (`employeeId` and `assignmentId` both unique — one fulfillment per
Employee/Assignment) so `requestedHeadcount` vs. `fulfillments.length` gives
the Partially Filled / Filled counts directly, and each individual
Employee+Assignment pair created from the request stays traceable back to it.

### Status machine kept intentionally simpler than the Build Guide's own list
WF-13 lists a fuller lifecycle (through Manpower/Candidate/Selected Person
stages); since those modules aren't built, `RecruitmentRequestStatus` skips
straight from `APPROVED` to accepting fulfillments — `RECRUITMENT_IN_PROGRESS`
exists as the zero-fulfillments-yet state so the status still communicates
"approved, nothing hired yet" vs. "approved, hiring underway," without
modeling stages this increment doesn't implement. `canRequestAcceptFulfillment()`
(`src/lib/recruitment.ts`) is the single source of truth for which statuses
allow `createEmployeeFromRecruitmentRequest` to run, checked both for showing/
hiding the "Buat Karyawan" button and again server-side before the transaction.

### Employee/Assignment/Fulfillment created in one `prisma.$transaction`
All three rows (plus the Position status nudge) commit atomically in
`createEmployeeFromRecruitmentRequest` (`src/app/(app)/recruitment/actions.ts`)
— a failure partway through (e.g. a duplicate employeeNumber slipping past
the pre-check under a race) can't leave an Employee with no Assignment or a
Fulfillment pointing at a half-created record. Pre-transaction validation
re-checks `canRequestAcceptFulfillment`, `!counts.isFull`, employeeNumber
uniqueness, that the chosen Position's `jobId`/`orgUnitId` actually match the
request's, and `!isPositionOccupiedByPrimary()` — all the same checks the
manual create-employee and Movement flows already enforce, applied here too
rather than assuming the UI's own filtering is sufficient.

### Bug found and fixed while building this: `movePrimaryAssignment` had no occupied-position check
While writing the "reject an already-Primary-occupied Position" acceptance
check for the new fulfillment flow, found the existing Movement action
(`assignment-actions.ts`, from Phase 1) had no equivalent guard — nothing
stopped two different Employees from both holding an active PRIMARY
assignment on the same Position at once. Extracted the check into a new
shared `src/lib/position-occupancy.ts` (`isPositionOccupiedByPrimary()`,
`syncPositionStatus()`, replacing a duplicated local copy that used to live
in both `assignment-actions.ts` and `import-export/assignments.ts`) and
applied it to all three call sites: Movement, the Assignment CSV import's
PRIMARY-row path (which also gained an in-file duplicate-Position check
across rows of the same batch), and the new recruitment fulfillment
transaction.

### Direct employee creation (no Recruitment Request) still works, per DEC-014
`/employees/new` (Phase 1) is untouched and still HR-Admin-reachable —
`Employee` has no required FK to `RecruitmentRequest`. The recruitment list
page keeps a "Buat Karyawan Langsung (Tanpa Permintaan)" link next to "Buat
Permintaan Baru" so both creation sources stay one click away, matching
DEC-014's explicit statement that Recruitment Request is optional context,
not a mandatory gate in front of employee creation.

### Request numbering: server-generated, not user-entered
`formatRequestNumber()` (`src/lib/recruitment.ts`) produces `REQ-{year}-{4-digit
sequence}` at submit time from a count of existing requests that year — the
submitter never types a request number, avoiding collisions/typos on a field
that's meant to be a stable reference ID.

### Permissions: submit is broad, approve/fulfill are HR-Admin-only
`canSubmitRecruitmentRequest` allows any linked Employee (not just managers)
to submit a request, matching the Build Guide's requester field being "any
employee, defaults to self" rather than a manager-only action; the list page
scopes non-HR-Admin users to only their own submitted requests.
`canApproveRecruitmentRequest` and `canCreateEmployeeFromRequest` are both
HR-Admin-only, consistent with every other Phase 0/1 write-access boundary in
this app (`src/lib/permissions.ts`).

### Verified live, not just via unit tests
Submitted REQ-2026-0001 (2 headcount, Staf Produksi/Produksi) as
`hr.admin@cbp.demo`, approved it, created two vacant Positions through the
existing `/admin/positions` UI (both existing Staf Produksi seats were
already occupied from Phase 1 testing — no backend access used), then
created Employee 1 and confirmed the request showed "Terisi Sebagian" (1/2),
created Employee 2 and confirmed "Terisi Penuh" (2/2), confirmed both
Employees/Assignments appear under "Karyawan yang Ditautkan," confirmed a
third `/create-employee` visit is blocked with "Permintaan ini sudah terisi
penuh," and confirmed the audit log has one entry per step (submit, approve,
each Employee create, each Fulfillment link). 10 new unit tests added
(`src/lib/recruitment.test.ts`) for the pure status/count logic; 43 tests
total across 5 files, all passing, plus a clean `tsc --noEmit` and `eslint`.

### Where it lives
`prisma/schema.prisma` (`RecruitmentRequest`, `RecruitmentRequestFulfillment`,
five new enums) — migration `20260728124417_phase2_recruitment_request`,
purely additive. `src/lib/recruitment.ts` (pure logic, unit tested),
`src/lib/position-occupancy.ts` (shared occupancy check, new this phase).
`src/app/(app)/recruitment/` — list page, `new/` (submit form),
`[id]/` (detail + approve/reject/return decision), `[id]/create-employee/`
(the transactional fulfillment form). Nav entry gated by
`canSubmitRecruitmentRequest`.

## 2026-07-28 — CTL-13 universal import/export, retrofit to Phase 0/1

Before starting Phase 2, re-checked the live Build Guide and found it now
gates Phase 2 on two things: Phase 0/1 checkpoints being recorded Accepted
in the **15 In-App Review** tab (several were still "Not Reviewed" there
despite the phase-summary rows saying "Accepted"), and a new cross-phase
rule, **CTL-13 ("Universal import and export")**, applying retroactively to
every Phase 0/1 dataset. Asked the user how to proceed; they chose to build
CTL-13 for Phase 0/1 first.

### Scope interpreted from CTL-13's text
"Every business dataset delivered in a phase must provide a downloadable
XLSX/CSV template, dry-run import with field mapping, create/update upsert
rules and row-level errors, plus permission-filtered XLSX/CSV export.
File-bearing records must support authorized ZIP export with a manifest and
ZIP/manifest import." Applied to Phase 0/1's five datasets: Employee, Org
Unit, Job, Position, Assignment — plus Employee's KTP/KK/other documents as
the file-bearing case.

- **CSV only, not XLSX.** Both formats are allowed per the wording ("XLSX/CSV"
  reads as "either"); CSV avoids adding a spreadsheet-generation dependency
  (SheetJS/exceljs) for a decision that doesn't change any product behavior.
  Revisit if the user specifically wants native `.xlsx` files.
- **Natural-key upsert, not internal IDs.** Templates/imports reference
  related records by their human business codes (`unitCode`, `jobCode`,
  `positionCode`, `employeeNumber`) never internal cuids, since a person
  filling a spreadsheet can't know a cuid. Each dataset module re-resolves
  "does this natural key already exist?" **at commit time**, not from a
  value cached during the dry-run preview — simpler and safer than passing a
  stale resolved ID forward (a record created by someone else between
  preview and commit is still handled correctly).
- **Assignment import is create-only.** There's no natural key that
  identifies "the same" assignment row to update, and DM-10 already forbids
  overwriting assignment history — every valid row always creates a new
  Assignment. A `PRIMARY`-type row replicates the exact same close-old/
  open-new logic as the Movement UI action (including keeping
  `Employee.currentPositionId` and `Position.positionStatus` in sync), so a
  bulk Primary-position import can't leave two active Primary assignments.
- **Employee export reuses `projectEmployee`.** Rather than a separate
  export-specific redaction ruleset, `employees.ts`'s `exportData()` calls
  the exact same field-projection function the UI uses — a Training/GA
  Admin's CSV export is redacted exactly the way their screen view already
  is (verified live: GA Admin's export has the `noKk`/`namaIbuKandung`/
  `ptkpStatusCode`/contact columns present but blank, never the values).
- **Document export/import is ZIP+manifest, not per-file.** One
  `manifest.csv` (employeeNumber, category, filename, MIME, size, uploader,
  timestamp, zip-entry-path) plus one ZIP entry per `FileObject`. Import
  re-validates every entry through the same `validateDocumentFile()` used by
  the single-file upload panel — confirmed live that re-importing an
  employee's own exported ZIP correctly rejects the non-KTP/KK `.txt`
  contract file (wrong extension for that check) while accepting the PDF.
  Every ZIP import is additive (new `FileObject` rows); a KTP/KK entry still
  repoints `Employee.ktpFileId`/`kkFileId` the same way the single-upload
  "Ganti" flow does.
- **`ImportRow.createdEmployeeId` generalized to `createdRecordId`**, plus a
  new `rowAction` ("CREATE"/"UPDATE") column, since the row-level result of
  a commit is no longer always an Employee. Migrated by hand (Prisma's
  `migrate dev` refused to run non-interactively over a column with existing
  data) — the migration explicitly copies old values into the new columns
  rather than dropping them; verified after applying that both pre-existing
  `ImportRow.createdEmployeeId` references survived the rename.

### Where it lives
`src/lib/import-export/` — `types.ts`/`csv.ts` (shared), one module per
dataset (`employees.ts`, `org-units.ts`, `jobs.ts`, `positions.ts`,
`assignments.ts`, each exporting `templateHeaders`/`dryRun`/`commitRow`/
`exportData`), `registry.ts` (dataset-key → module lookup used by the
generic routes/pages), `employee-documents-zip.ts` (the ZIP+manifest case).
`/import` is now a hub listing all datasets with template/export/import per
card; `/import/[batchId]` generalized to show whichever dataset's own first
few template columns as the preview table, and to label committed rows
"Dibuat"/"Diperbarui" using the actual per-row action returned by
`commitRow()` (not the pre-commit dry-run guess, so a race between preview
and commit can't produce a mislabeled result). `/api/import-export/
template/[dataset]` and `/api/import-export/export/[dataset]` are thin
permission-checked, audit-logged route handlers shared by every dataset.

## 2026-07-28 — Phase 1 reopened: Employee Master gaps + Director hierarchy (DEC-011)

Phase 1 was reopened per DEC-011 (Build Guide Decision Log): Employee Master
was missing No. KK, Nama Ibu Kandung, Pendidikan Terakhir, PTKP Pajak, and
KTP/KK file uploads (DM-17 through DM-20, CTL-12), and the org chart had no
Director-as-single-root layer above Department Heads (ORG-15). Also noted:
**DEC-010 changed the canonical phase order** — it is now Phase 0 Foundation,
Phase 1 Employee & Organization, **Phase 2 Employee Lifecycle** (moved up;
now includes contract renewal per DEC-009), Phase 3 Competency & Training,
Phase 4 Assets, Phase 5 Later Operations. Recorded here so a future session
doesn't build against the old ordering from the original Phase 0/1 work.

### Schema: additive migration, zero data loss
Added `Employee.noKk`, `namaIbuKandung`, `educationLevelId` (FK to new
`EducationLevel`), `ptkpStatusCode` (FK to new `PtkpStatus`, keyed by the
code itself since PTKP codes are already stable regulatory identifiers —
`educationLevelId` uses a surrogate id instead since education-level labels
are the kind of thing an admin might reword), and `ktpFileId`/`kkFileId`
(unique FKs to `FileObject`). All six are nullable at the database level —
per the explicit instruction not to destroy or block existing records.
Applied via `prisma migrate dev` (not `db:reset`); SQLite required a
table-rebuild migration to add the FK columns (a normal Prisma/SQLite
behavior, not a data-loss operation) — verified the generated migration SQL
includes the `INSERT INTO new_Employee SELECT ... FROM Employee` copy step,
and confirmed after running it that all pre-existing employees, positions,
and assignments were intact.

### Existing incomplete records: flagged, not blocked
Rather than making any of the six new fields required at the database level
(which would break existing rows), completeness is computed on demand
(`src/lib/employee-completeness.ts`) and surfaced as an amber banner on the
employee list (HR Admin only) and detail page (HR Admin or self), listing
exactly which of the six fields are still missing. Going forward, the
**create** and **edit** forms make Pendidikan Terakhir and PTKP Pajak
required `<select>` fields (matching the Build Guide's "Required dropdown"
wording for DM-19/DM-20) — No. KK and Nama Ibu Kandung stay optional-but-
validated-if-present, since forcing them retroactively on every edit would
block unrelated urgent edits (e.g. fixing a phone number) on legacy records
that don't have them yet. KTP/KK are uploaded separately from the create/edit
form (a File needs an existing Employee row to attach to), so they can never
block employee creation either.

### Identity/compliance fields are HR-Admin-edit-only, not self-editable
No. KK, Nama Ibu Kandung, Pendidikan Terakhir, and PTKP Pajak can only be
*written* by HR Admin, even though the employee can *view* their own values
(same self-view rule as the rest of Employee Master). This mirrors the
Build Guide's document-access line ("HR Admin – People & Payroll has full
access. An employee may access only their own permitted documents") applied
by analogy to the equivalent identity fields, not just the files — self-
service edits stay limited to plain contact info (phone/address/emergency
contact), same as before this phase.

### Document upload: HR-Admin-only, randomized keys, MIME+extension checked
`uploadIdentityDocument()` (`src/app/(app)/employees/[id]/document-actions.ts`)
is reachable only from the employee detail page's new "Dokumen Identitas"
panel. Per CTL-12:
- Upload/replace is HR Admin only (view/download remains self-or-HR-Admin,
  same as every other document in this app since Phase 0).
- `validateDocumentFile()` (`src/lib/validation/employee-fields.ts`) checks
  MIME type **and** file extension independently — a renamed file reporting
  an allowed MIME type but a disallowed extension is still rejected — plus a
  10 MB size cap, all before anything touches disk or the database.
- `randomStorageKey()` (`src/lib/file-storage.ts`) generates a UUID-based
  on-disk filename, never derived from the original filename, per "use
  randomized storage keys."
- A **replacement** upload creates a brand-new `FileObject` row and repoints
  `Employee.ktpFileId`/`kkFileId` to it; the superseded row is left alone
  (still linked via `FileObject.employeeId`) so replacement history isn't
  lost, and the audit reason records whether it was an upload or a replace.
- The generic "Dokumen" list on the employee profile (from Phase 0) now
  excludes `category: "KTP"|"KK"` rows so they only ever appear once, in the
  dedicated panel — and that panel itself is only rendered for
  self/HR Admin, matching `/api/files/[id]`'s own check, after testing
  surfaced that GA Admin could otherwise see a KTP/KK *filename* (though not
  download it) via the generic list.

### `permissions.ts` split from `require-session.ts`
`requireSession()` moved to its own file. Reason: it needs `next/navigation`
and the NextAuth instance, both Next.js-runtime-only; keeping it inside
`permissions.ts` meant every unit test for a pure predicate (`isHrAdmin`,
`projectEmployee`, `canViewEmployeeDocument`, etc.) transitively pulled in
`next-auth` and failed under Vitest with a module-resolution error
(`next/server` import inside `next-auth/lib/env.js`). `permissions.ts` is now
dependency-free besides a type-only `next-auth` import (erased at compile
time), so it can be tested with plain mock session/employee objects. Every
call site's import was updated; no behavior changed.

### Bug found and fixed while testing: same-day Movement boundary overlap
Testing the reopened Director hierarchy surfaced a real bug: when Movement
closes an old Primary assignment and opens a new one on the *same calendar
day*, the org chart's as-of-date query previously used an inclusive range on
both ends (`effectiveFrom <= date <= effectiveTo`), so both the just-ended
and just-started assignment matched on that boundary day — the same
employee rendered twice on one position card. Fixed by switching to a
standard half-open interval, `effectiveFrom <= date < effectiveTo`
(`src/lib/org-chart.ts`): `effectiveTo` is now the first date a row is *no
longer* active, not the last date it *is* active. Confirmed fixed live (Budi
holding a Primary + a fresh Acting assignment now renders once per position,
correctly) and no regression on the existing "as-of a past date" scenario
(still correctly excludes an assignment before its `effectiveFrom`).

### Director hierarchy: seeded, not hand-entered
Added to `prisma/seed.ts` (idempotent, safe to rerun): a `Direksi` org unit,
a `Direktur Utama` Position (`positionType: DIRECTOR`, `reportsToPositionId:
null`, left **vacant** on purpose — demonstrates ORG-15's "can remain
visible when vacant" without needing a 6th demo employee), and a `Kepala
Departemen Produksi` Position (`DEPARTMENT_HEAD`, reporting to the
Director) that the existing `Kepala Seksi Produksi` Position was reparented
under. The reparenting is written as an explicit `prisma.position.update()`
guarded by an equality check (not relying on upsert's `update: {}`, which
intentionally leaves pre-existing rows untouched) so it "self-heals" the
reporting line even against a database seeded before this Director layer
existed, without touching anything else about that row.

### Structure warnings are computed, not stored
`computeStructureWarnings()` (`src/lib/org-chart.ts`, unit tested in
`org-chart.test.ts`) checks, fresh on every load: exactly one Position with
`positionType: DIRECTOR` and no `reportsToPositionId`; every
`DEPARTMENT_HEAD` Position's `reportsToPositionId` chain eventually reaches
that Director (circular-reference-safe); and separately flags any other
non-Director Position with no reports-to (the existing ORG-02-style check
from Phase 1's first pass, now split out from the Director-specific ones).
While building this, a **real** pre-existing stray Position ("Manager FP",
`DEPARTMENT_HEAD`, no reports-to) already in the dev database triggered
both warnings correctly on the first try — left in place rather than
deleted, since it's a good live demonstration of the validation working
against a genuine data-quality issue rather than only synthetic test data,
and per "do not delete or recreate the existing database."

### Testing: added Vitest, 33 tests across 4 files
`validateNoKk`/`validateDocumentFile` (format, MIME+extension, size-boundary
cases), `isEmployeeProfileIncomplete`/`missingFieldLabels`, the RBAC
predicates plus `projectEmployee`'s field-stripping for the new sensitive
fields, and `computeStructureWarnings` (well-formed chain, missing Director,
duplicate Director, orphan Department Head, stray non-Director root,
circular-reference guard). Chosen over Playwright/e2e for this pass because
the acceptance checklist's actual business logic (validation, permission
predicates, structure-warning computation) is unit-testable in isolation;
the full click-through was still verified manually in the running app per
SRC-06, not skipped in favor of the unit tests.

### Phase status: I can't write to the Google Sheet
This session only has read access to the Build Guide via the Drive
connector (search/read/download, no update). Phase 1's status in the
**14 Build Phases** and **15 In-App Review** tabs should be moved from
"In Progress"/"Not Reviewed" to **"Ready for In-App Review"** — I'm
recording that here and telling the user directly, since I can't edit the
Sheet myself. Not marking it "Accepted" — that's the user's call after
reviewing the running app.

## 2026-07-28 — Phase 1 (Employee & Organization) decisions

### Hard constraint: every edit/config is a button, never backend access
The user confirmed explicitly that nobody operating this app will ever write
code or touch the backend/database directly — every create/edit/deactivate
action needs an in-app form. This changes how "done" is defined for every
future phase: a feature isn't finished when the schema + a read-only view
exist, it's finished when there's a button for it. Phase 1 accordingly ships
full CRUD UI for Org Units, Jobs, Positions (`/admin/org-units`,
`/admin/jobs`, `/admin/positions`, HR Admin only), manual Employee creation
(`/employees/new`, separate from the bulk CSV import) and editing
(`/employees/[id]/edit`, self or HR Admin), and Assignment management
(add Additional/Acting/Temporary, Movement, end a non-Primary assignment —
all from the employee detail page). See the `feedback_hr_app_no_backend_access`
memory for the standing rule.

### Position occupancy: computed live from Assignment, not a cached flag
`Position.positionStatus` (PLANNED/VACANT/FILLED/FROZEN/CLOSED) is a field
HR Admin can set directly, but it is **not** what the org chart uses to decide
whether a seat shows an occupant. The org chart (`src/lib/org-chart.ts`)
always queries `Assignment` rows whose `effectiveFrom`/`effectiveTo` range
covers the selected as-of date — this is what makes "view chart as of two
dates" (Phase 1's own acceptance scenario) actually correct, and it's also
why an employee can validly show up in more than one Position node at once
(ORG-05) without a stored flag needing to be kept in sync per position. The
stored `positionStatus` is auto-nudged between VACANT/FILLED whenever an
Assignment is added/moved/ended (`syncPositionStatus()` in
`assignment-actions.ts`), but only when its current value is VACANT or
FILLED — an admin-set PLANNED/FROZEN/CLOSED is never silently overwritten.

### Movement vs. Add Assignment vs. End Assignment are three distinct actions
Rather than one generic "edit assignment" form, the employee detail page has:
- **Tambah Penempatan** — creates a new Additional/Acting/Temporary
  Assignment. Never touches the Primary Assignment or `Employee.currentPositionId`.
- **Pindahkan ke Posisi Baru** (Movement) — the only way to change an
  employee's Primary position. Closes the current Primary Assignment
  (`effectiveTo` = the move date, `status = ENDED`) and creates a new Primary
  Assignment, then updates `Employee.currentPositionId`. This is what
  DM-10 ("no historical overwrite") requires — the old row is closed, never
  deleted or mutated into the new one.
- **Akhiri** (End) — only available on non-Primary assignments. Ending a
  Primary assignment without a replacement isn't offered here on purpose;
  that's an offboarding scenario (Resignation/Exit Clearance), which is
  Phase 4 territory, not Phase 1.

### Org chart implementation
Built with `d3-hierarchy` (`stratify()` + `tree()`) for pure layout math only
— no DOM manipulation library, no SVG-driven re-render framework. The
computed `x`/`y` per position are rendered as plain absolutely-positioned React
`div`s (cards) with an SVG layer underneath just for the connector lines, all
inside a container whose pan (`translate`) and zoom (`scale`) are driven by
plain mouse/wheel handlers in React state. This was simpler and more
debuggable than adopting a full charting/zoom library for what's currently a
handful of nodes. Multiple root positions (no `reportsToPositionId`) are
supported by wrapping everything under a synthetic, unrendered root node for
`stratify()` — and flagged to the user as a data-quality warning banner if
there's more than one (a lightweight stand-in for ORG-12's "multiple top
roots" warning; the fuller validation set — circular reporting, orphan
Assignment, invalid level, etc. — is not built yet).
Department filtering and search **dim** non-matching cards rather than
removing them from the tree, so the hierarchy structure never breaks when a
filter is active — deferred a "collapse to only the filtered subtree" mode as
a nice-to-have, not needed for the Phase 1 acceptance scenarios.
Landscape/image export (part of ORG-10, P1) is not built yet.

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

### Offboarding: HR Admin starts it, no approval (2026-09-24)
Per direct user request, quitting is no longer approved in the app. HR Admin
alone opens an offboarding case (`/offboarding/new`, or the button on the
employee page); every case starts at `PENDING_CLEARANCE` and goes
straight to exit clearance. This supersedes the LIF-06/07/12 Dept Head → HR
Manager stages: `PENDING_DEPT_HEAD`/`PENDING_HR_MANAGER` and the
`deptHeadDecision*`/`hrManagerDecision*` columns were removed (migration
`20260924080000_offboarding_hr_admin_only`; old rows, if any, fold into
`PENDING_CLEARANCE`). Manager-reported resignations are gone too.
Visibility: HR Admin (all cases, cancel, execute clearance), the leaving
employee (own case only, fills the Exit Clearance form), and GA Admin via the
separate asset-clearance page. Contract non-renewal handoff is unchanged.

### Employee login by email: invite, create password, reset (2026-09-24)
Per direct user answers: the login name is the employee's **Email Pribadi**;
Admin SDM creates the account with a per-person or "undang semua" button
(never self-signup); the employee chooses their own password from an emailed
one-time link (invitation valid 7 days, reset 1 day; only a SHA-256 of the
token is stored — `AccountToken`). Password rule: 8+ characters with a letter
and a digit. A locked account (5 wrong attempts) is opened by a successful
reset. "Lupa kata sandi" always answers the same neutral message and has a
60-second per-account cooldown. An employee without an Email Pribadi cannot be
invited (no Admin-SDM-set temporary passwords). Mail goes out over Gmail SMTP
(`SMTP_*` env vars). The three seeded admin accounts keep their current
passwords for now (decided to leave for later). Code: `lib/account-access.ts`,
`lib/account-tokens.ts`, `lib/mailer.ts`, `/forgot-password`, `/set-password`,
`/change-password`, and the "Akun Masuk" panel on the employee page.

### Dropped Employee.workEmail; Pendidikan/PTKP lists gained rename+reorder (2026-09-29)
Per direct user request. "Email Kantor" was never used for login (that's
`personalEmail` — see the entry above) and wasn't required anywhere; the field,
its column, and every reference (create forms, profile view, import/export,
`projectEmployee` masking) are removed (migration `20260929080000_drop_work_email`).
Separately, Pengaturan > Pengaturan Data Karyawan's two dropdown lists
(Pendidikan Terakhir, PTKP Pajak) only supported add + activate/deactivate —
brought up to the same rename/reorder/toggle pattern already used for Alasan
Keluar and Pertanyaan Klirens Keluar (`level-manager.tsx`, `status-manager.tsx`).
PTKP's code itself stays fixed once created (Employee.ptkpStatusCode points at
it directly) — only its label is editable.

### Late check-ins: per-shift start time, automatic Setengah Hari from the check-in time (2026-10-12)
Per direct user request (first built to wait for the check-out, then changed the same day to "no need to wait for
check out, just see the check-in time"). Before, "late" was a fixed rule (check-in after 07:40 for everyone) that
only flagged a mobile check-in and only informed Admin SDM; a late day still counted as a full present day.
Now:
- **Start time per shift.** New table `ShiftStartConfig` (shift, "HH:MM", grace minutes), edited next to the
  schedule minutes in Pengaturan > Pengaturan Absensi > Libur & Jadwal Kerja. Shift 1 starts at 07:30 with 10
  minutes grace (the old rule); Shift 2 and Shift 3 start empty, and a shift with no start time is never late.
  A person is judged against the shift rostered that week (Shift 1 when none). Fingerprint punches are
  judged by the same rule; the "late" column stored on mobile events is no longer used for decisions.
- **Automatic outcome from the first check-in** (`lib/attendance-auto-day.ts`, derived live, nothing stored, no
  waiting for the check-out): late (after start plus grace) by less than half of the shift's scheduled minutes
  stays a full day; late by half of it or more, measured from the start time (4 hours on an 8-hour shift, 3 hours
  on a 6-hour shift), is a Setengah Hari (code SH: 0.5 hours, -1 point, counted in Mandays Lost like one entered by
  hand). A half day decided this way is not asked about again in the unresolved queue even without a check-out.
- **Out of location** (mobile check-in outside every registered location) is only flagged in "Catatan Terlambat &
  Di Luar Lokasi" with the employee's reason; it never changes hours or points.
- **Admin SDM always wins:** a day with an absence code, "Masuk" or a shift-only entry is never changed by the rule.
- **Known limits:** an overnight shift's punches are grouped by calendar day, so a night shift's start time
  should be set on the same day it is meant for; a day with a punch but no scheduled minutes (day off or public
  holiday) is left alone. Jam Kerja Aktual still counts the scheduled hours for a punched day, as it did for any
  SH entered by hand.

### A check-in alone counts the day as worked (2026-10-12)
Per direct user request ("all days counted present from check-in, but hours counted by the shift, never more than the
shift"). Before, the grid, the payroll Excel and the unresolved queue needed both a check-in and a check-out, so a day
with only a check-in showed "?" and 0 hours until the check-out arrived. Now a check-in is enough: the day counts as
present with the shift's scheduled minutes (Jam Kerja Gaji and Aktual, never more than the schedule), an approved
leave request no longer covers a day with a check-in, and a day with a check-in is never in the unresolved queue. A
check-out with no check-in is still unresolved. A person who forgets to check out is therefore paid the full shift
until Admin SDM corrects the day (for example with a leave code or Setengah Hari).

### Start time per weekday, and Tipe Absensi / Shift filters on the grid (2026-10-12)
Per direct user request (Shift 2 and Shift 3 start at different times on different days; the grid should filter by
absence type and by employee shift). Chosen from a mock-up:
- **Start time per shift and weekday.** `WorkScheduleConfig.startTime` ("HH:MM", null = not set, never late). The
  Jadwal Jam Kerja per Shift card is now a table per shift (day, working minutes, Jam masuk, "Terlambat setelah",
  "Setengah Hari mulai"; the last two are worked out live). Grace stays one number per shift
  (`ShiftStartConfig.graceMinutes`). `ShiftStartConfig.startTime` is no longer read; Shift 1's old 07:30 was copied
  onto its working days by the migration. The Setengah Hari limit is half of that weekday's scheduled minutes after
  its start time. A day with no working minutes has no start time.
- **Grid filters** (`lib/attendance-grid-filter.ts`): "Shift karyawan" (Shift 1/2/3) and "Tipe Absensi" (Hadir, every
  absence code, "?" unresolved, "L" day off; several can be chosen). An employee stays when, on the shown date range,
  they had any chosen type and were on the chosen shift on any shown day (the shift can change week to week). Days of
  the chosen types are marked, the rest fade. The Excel export applies the same filters over the whole period.

### Recruitment pipeline: applicants, tests, interviews, offers (2026-10-19)
Per direct user request, from the workflow draft "Rancangan Alur Kerja Recruitment" (revisi ke-4) and a clickable
mock-up. Choices: Pelamar table with stage filter + a Pelamar menu across all requests; tests one question per screen;
applicant gives name, email and WhatsApp (all required) and may upload a CV; the applicant sees only a thank you after
the tests (results come from HR); internal vacancies are a card on Beranda (not a sidebar item); essays are judged
Lulus / Tidak Lulus with a note; interviewers score 1-5 per aspect plus a recommendation and note; HR Admin sees the
results side by side; the offering letter is answered through a one-time link with an on-screen signature; tests are
chosen once per job title.
- **Who may apply.** Each request has `openFor` (Belum dibuka / Eksternal / Internal / Keduanya; default Belum dibuka,
  so nothing is public by accident) and, for external, an access code (`CBP-XXXX-XXXX`, new one on demand). Public page:
  `/cbp-recruitment` (lowongan), `/cbp-recruitment/apply/[requestId]`, `/cbp-recruitment/tes/[token]`,
  `/cbp-recruitment/offer/[token]`. No sign-in; the proxy lets `/cbp-recruitment` through. A vacancy only accepts
  applicants when the request is Disetujui / Berjalan / Terisi Sebagian, has a job, is not full, every required test
  has questions, and (external) has a code.
- **Tests.** `RecruitmentTestType` catalog (Cultural Fit is the gate, taken first by everyone; Ketelitian; Studi Kasus;
  more can be added in the app). Forms: scale 1-5 and multiple choice are graded at once (pass mark per test, scale
  statements can be reverse-scored), essay waits for reviewers HR Admin picks. Time limit per test is enforced by the
  server (deadline saved when the test starts); a test left open is closed by the nightly job. Copy/paste is blocked in
  the page (a deterrent only). Question banks start empty: HR Admin writes them in Pengaturan Rekrutmen (one by one or
  pasted). A question already answered can only be deactivated.
- **Tests per job title.** `RecruitmentJobTest`; Cultural Fit is always on top.
- **Re-applying.** The same email cannot have two live applications for one vacancy; after failing the tests or being
  rejected it must wait `retakeDays` (30) before applying to any vacancy. Declining an offer or losing out to someone
  else does not make anyone wait.
- **Data kept.** Applicants who left without a hire are kept `retentionDays` (30), then HR Admin can delete them with one
  button on the Pelamar page after seeing the list (answers, interview notes, offer and CV go too). Never automatic;
  applicants who became employees are never deleted.
- **Interview.** HR Admin picks 1 to 4 interviewers (any employee with a login); the aspects they score are a list HR
  Admin edits. Each interviewer submits once. HR Admin fills the administrative part and sets the final decision by hand
  (no vote counting). Accepted / Dipertimbangkan continue; Ditolak ends the applicant.
- **Offer (external).** HR Admin uploads the PDF and signs for the company on screen, sends a one-time 7-day link (email
  plus a copyable link and WhatsApp button), the applicant signs and accepts or declines. HR Admin can also record an
  answer given by phone. A decline closes the applicant only; the request stays open. "Buat Karyawan dari Kandidat"
  opens the existing create-employee form with the applicant's name, mobile and email filled in.
- **Internal.** An employee applies from Lowongan Internal (card on Beranda) and takes the same tests. After the
  interview HR Admin opens Perubahan Posisi from the applicant; carrying out that move finishes the applicant, counts
  as a hire for the request, and emails the managers of the old and the new seat. The manager is not told earlier.
- **Full request.** When a request reaches its headcount (by Buat Karyawan or an internal move) everyone still in the
  pipeline becomes Tidak Terpilih.
- Every hire still goes through the existing Employee / Perubahan Posisi / Kontrak code; nothing there was replaced.

### Admin Rekrutmen: a separate login for the applicant pipeline (2026-10-19)
Per direct user request ("literally separate login like Admin SDM, access to move employees for internal
recruitment but that's it"). New role `RECRUITMENT_ADMIN` on a stand-alone `ADMIN` account with no employee record
(like the Admin SDM login). Admin SDM creates it under Pengaturan > Akun Admin Rekrutmen (email, then the person sets
their own password from the emailed link; can resend the link, hold and reactivate). Admin SDM keeps the same
recruitment access.
- **Can:** Pelamar menu and applicant pages, tests and question banks, interviews, offers, open or close a vacancy and
  its access code, Buat Karyawan dari Kandidat, and for an internal applicant: open Perubahan Posisi for that one
  employee and carry out the approved move (button on the applicant page). They see every request.
- **Cannot:** employee pages and lists, any other Perubahan Posisi, approvals, evaluations, other modules.
- The move is filed in the name of the vacancy's own requester (the login has no employee record), approvals stay
  Kepala Departemen and HR Manager, and Admin SDM still releases the evaluation that Perubahan Posisi needs.
- After Buat Karyawan, Admin Rekrutmen returns to the request page (it cannot open employee pages).

### Ketelitian Set A / Set B, Logika Dasar, "Istimewa" (2026-10-20)
From the HC spec "recruitment-module-spec.md" and the question bank "Bank Soal v5". Owner's answers: Set A and Set B rotate
automatically per applicant; applicants at 90% or more get an "Istimewa" label for HR; time limits Ketelitian 15 minutes,
Logika Dasar 30 minutes.
- **Alternative sets.** `RecruitmentTestType.variantGroup`: tests sharing a group are alternatives. A new applicant gets the one
  handed out least so far (a coin toss when equal), so the two sets stay balanced. Applicants only see the group name
  ("Ketelitian"); HR sees the real set on the applicant page. One tick in Tes per jabatan covers every set of the group, and every
  set must have questions before a vacancy can open.
- **Ketelitian.** Two tests ("Ketelitian Set A", "Ketelitian Set B"), 30 questions each (25 standard + 5 very hard, 10 points
  each, so the score is correct answers / 30), pass 80% (240/300), Istimewa from 90% (270/300), question text "Teks A / Teks B"
  with the answers SAMA or TIDAK. The 60 questions were loaded by migration 20261020030000 from the spec; every SAMA answer was
  checked to be an identical pair and every TIDAK a different pair.
- **Fixed-width font** (`monospace`): the questions are shown in a fixed-width font because several differ only by I / l / 1 or O / 0.
- **Istimewa** (`excellentScore`): a small label next to a passed test result in the applicant table and the applicant page. It
  changes nothing in the flow.
- **Logika Dasar**: created (pass 80%, 30 minutes) with no questions yet; the 20 questions are not in Bank Soal v5 and still have to be sent.
- Test instructions (the test's keterangan) are shown to the applicant before the test starts.
- **Shuffled answer options** (`shuffleOptions`, multiple choice only; on for Logika Dasar, off for Ketelitian): each applicant sees the
  options in their own order, the same order after a refresh (seeded by their test and the question), so "the key is always C" cannot be
  passed around (Logika Dasar had 13 of 20 keys at C). Options like "Semua benar" / "Tidak bisa ditentukan" stay last. Answers are saved
  and graded by the option's original number, so scoring did not change.

### Tests chosen per vacancy (2026-10-20)
Owner: which tests apply must be settable when a new lowongan is opened, not only per job title.
- Pelamar block of each request: "Tes untuk lowongan ini" (tick the tests, Ketelitian Set A+B is one tick, Cultural Fit always required). Starts from the job title tests (Pengaturan > Tes per jabatan); saving makes the vacancy keep its own pick (RecruitmentRequest.testsCustomized + testTypeIds); "Kembali ke tes bawaan jabatan" resets it.
- Applicants who already applied keep the tests they were given; the pick only affects new applicants. Readiness (every possible test has questions), the public apply page and test planning all read the vacancy pick.

### Dasbor Rekrutmen (2026-10-20)
From the HC spec "recruitment-dashboard-spec.md". Page /recruitment/dashboard (menu: Dasbor Rekrutmen), read-only, no schema change.
- **Access:** HR Admin and Admin Rekrutmen (canManageRecruitment), same as Pelamar. HR Manager does not see it (decided by the existing rule that applicant screens are HR Admin only; widen in permissions if wanted).
- **Eksternal vs Internal** is included now (source filter + a small block), since the data is there.
- **Filters:** department, level, applicant source, period (3/6/12 months, this year, all time, own dates; default 12 months, WIB days). Period is applied to the applying date for applicants/funnel/hiring rate; Time to Hire and Time to Fill are placed by the date of the hire / of the last seat filled, as the spec says. Time to Fill and the department filter use requests, so the source filter does not change Time to Fill.
- **Derived dates (no new columns):** the applicant table has no passedAt/invitedAt/hiredAt. Passed = every test passed (date of the last test result); invited = interview created/invitation sent; interview finished = HR final decision made; offering = offer or movement exists; hired = the day the status became HIRED (final status). A request counts as filled on the day its last seat was linked (FILLED requests only). Funnel is cumulative: a later stage implies the earlier ones.
- Pure rules in src/lib/recruitment-dashboard.ts (tested), queries in recruitment-dashboard-data.ts (3 parallel queries, no per-row lookups).

### Beranda Admin Rekrutmen like the other admins (2026-10-20)
Owner: the Admin Rekrutmen home must look like Admin GA / Admin SDM. UI mock-up first, then built.
- Layout = the Admin GA home: six summary tiles (Lowongan dibuka, Tes & penilaian, Interview, Offering, Perubahan Posisi (internal), Diterima 30 hari) with a red/amber/grey tag, a "Perlu ditindak" list (oldest wait on top, chips Esai / Interview / Offering / Perubahan Posisi, filter in the address as ?rec=), and side cards: Ringkasan 30 hari, Lowongan dibuka (a lowongan that cannot take applicants yet shows "Belum siap"), Cek pengaturan.
- Rules in src/lib/recruitment-home.ts (tested), queries in recruitment-home-queries.ts (all queries start together; the 30-day figures reuse the Dasbor Rekrutmen calculation). Applicants in the same step of the same request are one row ("4 pelamar lolos tes"). A scheduled interview within 7 days is listed as an FYI (grey) and is not counted as waiting for the recruiter.
- Row steps follow the existing next-step rules (candidateNextStep) plus one extra: an approved Perubahan Posisi of an internal applicant ("Jalankan perpindahan"), since Admin Rekrutmen carries it out.
- Admin SDM keeps its own Beranda; an account that is both only gets the Admin SDM one.

### The app is now called SAPA, with a new login page and mascot (2026-10-20)
Owner: rename "Aplikasi HC" to SAPA = Sistem Administrasi dan Pelayanan kAryawan (from "menyapa", to greet), slogan "Hadir menyapa, siap mendukung." (changed from "siap melayani" on 2026-10-21), new login UI/UX. UI mock-ups first; the owner picked the "Helm Pabrik" mascot on the "Fajar" (sunrise) background.
- Name: strings in i18n (app.name / fullName / slogan), browser tab title, installed-app name (manifest short name SAPA), sidebar, offline page, README, the invitation / password-reset emails and the messages to reviewers and interviewers. Company name and CBP logo unchanged.
- Login, forgot-password and set-password share one frame (AuthShell + client AuthStage): SAPA panel with the mascot on the left, form on the right; on a phone the panel is a header and the form a card over it.
- The mascot (SapaMascot, a speech bubble in a safety helmet) says a line in a bubble: greeting by company (WIB) time of day (04-11 pagi, 11-15 siang, 15-18 sore, otherwise malam; src/lib/greeting.ts), and reacts to the form: thinking while signing in, worried after a wrong password, happy after a new password was saved or a reset link was sent. Forms drive it with useAuthMood(). Motion stops for people who prefer reduced motion.
- No data or query changes; the greeting is read on the visitor's device, so the page can stay cached.

### Clean-up and speed pass, and "everyone gets the new version" (2026-10-20)
- **Fewer database round trips.** Prisma's `relationJoins` preview feature is switched on (generator in schema.prisma) and the heavy read paths ask for `relationLoadStrategy: "join"`: the Admin SDM Beranda went from 62 to 27 queries (about 125 ms instead of 260-320 ms in a quiet network), and the Admin GA / Admin Rekrutmen Beranda, pending approvals, applicant lists and the recruitment dashboard use it too. Outputs were compared before/after for every account and were identical. Other pages are unchanged; use the same option when a page with several nested relations feels slow.
- **Indexes.** Migration 20261020080000: 35 indexes on foreign keys that are looked up from the parent side (a course's sessions, a quiz's questions, a request's fulfilments, evaluator columns ...) and one duplicate index dropped (OnboardingCase.employeeId, already unique). Audit-only columns ("...ByAccountId") are deliberately not indexed.
- **Dead code removed:** the old manual contract "Mulai Tinjauan Perpanjangan" step (button, server action, rule, test and text; the automatic D-30 renewal case replaced it), an unused disposal-status rule, three copies of the same "most urgent first" sort (now one, `sortTodo` in ga-home.ts), unused re-exports.
- **New version reaches everyone.** Every build has an id (NEXT_PUBLIC_BUILD_ID, shown by /api/version). An open page checks it every 5 minutes and when it comes back to the front. A page nobody is looking at (and with nothing typed in it) reloads itself; a page someone is using shows a "Muat ulang" notice and never reloads by itself (it reloads once the person leaves, unless something typed is unsaved). The service worker (cache sapa-offline-v1) refreshes hidden windows of the installed app when it updates, and installed apps always load the new version when they are opened because pages come live from the server. Browsers update an installed app's name and icon on their own schedule (iPhone: only if the app is added again).
- `scripts/` (wipe and fixture scripts) is kept out of the Vercel upload (.vercelignore). `<html lang>` is now "id".

### SAPA app icon, and "butuh koneksi internet" when tapping the app (2026-10-21)
- **Icon.** The app icon (installed app on phone and desktop, browser tab, iPhone home screen) is now the SAPA helmet mascot on the sunrise purple, no longer the CBP logo. CBP's logo stays as the company logo on the login page and the public applicant pages. Files: public/pwa/icon-192, icon-512, maskable-512, src/app/icon.png, apple-icon.png, favicon.ico (drawn from the same shapes as components/sapa-mascot.tsx; kept inside the circle a phone may crop to).
- **Why the offline page showed although the internet was fine.** The service worker showed the offline page as soon as the first request for a page failed. Tapping the app icon or an email link wakes the phone's network up at the same moment and that first request often fails for about a second. Now: the browser's early request (navigation preload) is used when present, a page is asked for up to three times (now, +0.7 s, +1.8 s) before the offline page is shown, and the offline page itself keeps asking the server every 3 s and opens the real page by itself the moment it answers (cache sapa-offline-v2). Tested against the real sw.js (service-worker.test.ts).

### Evaluation: the second evaluator (P2) is optional (2026-10-21)
Owner: an evaluation may have just one person. Admin SDM picks the evaluator (P1) and may leave P2 empty; when P2 is chosen it must be a different person. The evaluation becomes Completed when every evaluator that was assigned has submitted (one or two) (`allAssignedEvaluatorsSubmitted` in lib/evaluation.ts). The panel shows the P2 block only when a P2 exists; the "(P1 dan P2) harus selesai" messages now just say the evaluation must be completed. Evaluations already released with two evaluators are unchanged. Competency assessment already works with P1 alone (P2 was dropped there earlier), so nothing changed in that module.
Also 2026-10-21: EVL-2026-0002 and MOV-2026-0002 (a Mutasi for CBP-0138 that was still waiting for the department head, nothing submitted) were deleted at the owner's request; a copy of both rows was kept outside the repo, the audit lines of their creation stay, and the EVL/MOV number counters were left as they were (the next numbers are 0003).

### Evaluation matrix: Performance and Tata Nilai (2026-10-21)
Owner's new FR-HC-01-07 matrix replaces the old criteria. **Section 1 Performance**, six criteria each graded 2, 4, 6 or 8: Kualitas Kerja, Komunikasi, Pemecahan Masalah, Pengambilan Keputusan, Kepemimpinan, Keahlian Teknis Pekerjaan (written "Kealihan" by the owner; read as Keahlian). **Section 2 Tata Nilai**, five values each graded 0, 25, 50, 75 or 100: Melayani Sepenuh Hati, Bangga Berbuat Jujur, Rencanakan apa yang dilakukan lakukanlah apa yang sudah direncanakan, Tiada hari tanpa kemajuan, Bersama kita membuat legenda. All 11 grades are required.
- **Result:** two separate results, no single final number: Performance total out of 48 and its percentage, and the average of the five tata nilai (0-100). `p1Total`/`p2Total` now hold the performance total; the tata nilai average is worked out from the stored grades.
- **Stored** as JSON `{version: 2, performance: {...}, tataNilai: {...}}` (lib/evaluation.ts, `parseEvaluationMatrix`). Evaluations submitted earlier keep their old grades and are still shown the old way (no `version`). Removed from the form: the KPI/Produktivitas option, Absensi, Tugas Khusus, SP, Kompetensi (the attendance numbers HR fills in when releasing are separate and stay).
- Form: grades are tapped as buttons, with a running total and average while filling in.

### Evaluation: who sees what, and the final-result screen (2026-10-21, supersedes the "Result" bullet above)
Owner: the evaluator only fills in the form and sends it; the final result is not for them.
- **Evaluator (P1/P2):** sees the attendance numbers Admin SDM filled in when releasing (sakit, ijin, alfa, ijin 1/2 hari) as a card above the form, then the two-section form with a progress bar (no totals while filling). There is no review step: the button sends. Pressed too early it scrolls to and highlights the criteria still empty. After sending the evaluator only sees "Terima kasih, evaluasi sudah dikirim", never a score.
- **Scores are seen by Admin SDM (from the first submission; shown as "sementara" with a dashed border while an evaluator is missing) and by the primary Department Head and the HR Manager (only once the evaluation is Completed)** (`canViewEvaluationResults` in permissions.ts; the HR Manager was added the same day at the owner's request). The evaluators and the employee see no scores.
- **Final result** (`evaluation-result.tsx`): the average of the evaluators who submitted, per criterion (`averageMatrixScores`): Performance total out of 48 with its percentage, and the average of the five tata nilai; a table per section with a column per evaluator and, with two evaluators, an average column; the attendance card. Still two separate results, no single combined number. Evaluations submitted on the old form keep the old per-evaluator display.
- "Komunikasi" is now "Komunikasi & Kolaborasi".

### Pengaturan Evaluasi: editable criteria and the PDF guideline (2026-10-21)
Owner: Admin SDM can change the matrix criteria in the app, and upload a PDF guideline every evaluator can read. Decided: **only the criteria names and order** are editable (plus adding a criterion and switching one off); the grades of each section (Performance 2/4/6/8, Tata Nilai 0/25/50/75/100), the two sections and their result mode (Performance = total and percent, Tata Nilai = average) stay fixed in code.
- **Where:** Pengaturan > Evaluasi Kinerja > Pedoman & Kriteria (`/admin/evaluation-settings`, Admin SDM only). Changes save at once, like the other Pengaturan lists (Alasan Keluar). Criteria are never deleted, only switched off; every section must keep at least one active criterion; at most 15 per section; names unique within a section.
- **Data:** `EvaluationCriterion` (section, stable `key`, label, sortOrder, active; seeded with the 11 criteria used so far, same keys) and `EvaluationSetting` (the guideline file). Migration 20261021090000, additive.
- **An evaluation keeps its own copy of the criteria.** `releaseEvaluation` stores the active criteria and their names in `Evaluation.matrixSnapshot` at release time; the form, the grade check and the result all read that copy (`matrixDefinitionOf`), so editing the matrix never changes an evaluation already under way or a finished one. An evaluation without a copy (released before this) uses the original 11 criteria. A saved grade is stored under the criterion's key.
- **PDF guideline:** one PDF (max 4 MB, checked for a real PDF header), stored like other private files (FileObject + FileBlob), opened by any signed-in person at `/api/evaluation-guideline`. Evaluators see a "Pedoman penilaian (PDF)" card at the top of their form (only when a PDF exists). Replacing or removing deletes the old file.
- Not built: a change history screen (changes are in the audit log).

### Mutasi tanpa evaluasi, dan "Isi dengan Mutasi" (2026-10-21)
Owner: a Mutasi needs no evaluation, and Admin SDM can fill a permintaan tenaga kerja with a Mutasi instead of a new hire.
- **Mutasi needs no evaluation.** `MOVEMENT_TYPES_REQUIRING_EVALUATION` is now Promosi and Demosi only. Submitting a Mutasi creates no Evaluation, the form no longer shows the evaluation-reference field for it, and nothing waits on one (the gate treats "no evaluation" as satisfied). A Mutasi already filed with an evaluation keeps it.
- **Isi dengan Mutasi (button for Admin SDM)** on the permintaan page (`/recruitment/[id]`, next to "Buat Karyawan") opens `/movements/new?recruitmentRequestId=…`: type fixed to Mutasi, the form filed for the request's own requester, new position limited to vacant seats of the request's Jabatan. Rules in `mutation-fill.ts` (`mutationFillProblem`): Jabatan set, request approved and not closed or full, not more Mutasi running than seats left (filled + open Mutasi < headcount), the seat vacant and of that Jabatan. Checked again on the server when filed.
- **Data:** `MovementRequest.recruitmentRequestId` (nullable, FK ON DELETE SET NULL, indexed). Migration 20261021100000, additive. The Mutasi goes through the normal approvals (Kepala Departemen, HR Manager, Admin SDM carries it out).
- **When carried out**, `completeInternalHire` (also used for internal applicants) now also handles a Mutasi linked straight to a request: it adds the request's fulfilment, advances the request status (Partially filled / Filled) and, when full, closes the remaining applicants. The permintaan page lists the Mutasi filed for it with their status.

### Jabatan di permintaan tenaga kerja, Kurangi jumlah, Tahan (2026-10-21)
Problem: requesters picked a wrong Jabatan from the company-wide list (or the Jabatan did not exist yet) and nobody could fix it after approval. Decided:
- **The requester only types the Jabatan name** (`requestedJobText`, required). The "Posisi yang Dituju" dropdown and the Level field are gone from the request form. Requests filed before keep their Jabatan (the text was filled from its title).
- **Admin SDM and Admin Rekrutmen set the standard Jabatan and the Level** on the request page (card "Jabatan standar", from the Dept Head stage on): pick an existing Jabatan (those with vacant seats in the department first) or "+ Buat jabatan baru" (name only, code JOB-nnn automatic, duplicate names refused). **The HR Manager no longer picks it**: Setujui stays off until a Jabatan is set (also on the Beranda approval row); the HR Manager sees the Jabatan, level and vacant seats instead. `requestedJobLevel` is now optional (empty until set).
- **"+ Tambah kursi"** creates empty seats for the Jabatan in the request's Department, reporting to the requester's seat, level and type copied from an existing seat of the same Jabatan (else from the level), code JOB-nnn-nnn.
- **Ubah jabatan after approval:** Admin SDM / Admin Rekrutmen, with a written reason, blocked once someone was placed through the request or a Mutasi (or an internal applicant's move) is running.
- **Kurangi jumlah** (requester, HR Manager, Admin SDM, Admin Rekrutmen), approved and not yet filled: reduce only, never add (a bigger need is a new request); lowest number = placed + running Mutasi (at least 1); needs a reason; no new approval; equal to the placed number makes it Terisi Penuh and closes the remaining applicants.
- **Tahan / Lanjutkan** (same four): approved and not filled. A flag (`heldAt`, `heldReason`) on the request, its real status is untouched. While held: no new applicants (public vacancy says it is paused, internal vacancies hidden), no interview scheduling, final decision (a rejection still works), offer, create employee or Isi dengan Mutasi; applicants stay, tests already sent can still be taken, an applicant can still answer an offer already sent. No automatic resume. The list has a "Ditahan" badge and filter.
- **Riwayat** (`RecruitmentRequestEvent`): every hold, resume, reduction and Jabatan set/change with who, when, reason. The other parties (requester, HR Manager, Admin SDM, Admin Rekrutmen, not the actor) are emailed. Migration 20261021110000, additive.
- Not built: a dashboard figure for held requests.

### Who must approve at the Department Head stage (2026-10-21)
REQ-2026-0002 sat at "Menunggu Persetujuan Kepala Departemen/Manajer" and nobody could tell whose approval was needed: it was filed for Quality Engineering, a department with no level-3B seat holder, so no one could ever approve it (the stage only accepts the 3B holder of that exact department).
- The request page shows "Menunggu persetujuan Kepala Departemen X: name (seat)", or a warning when nobody can approve; the list shows the same line under the status (\`listDeptHeadApprovers\` in dept-head.ts).
- Filing or resubmitting a request for a department without a Department Head is refused with an explanation, so a request can no longer get stuck there.
- Perubahan Posisi has the same Department Head stage and is not changed here.

### Detail lowongan written by Admin Rekrutmen, and "Belum dibuka" on the Beranda (2026-10-22)
- **What applicants read is not the request's text.** The job description and special criteria on the request (FR-HC-01-01) are internal. Admin Rekrutmen / Admin SDM write the vacancy's own text on the request page (card "Detail lowongan" in the Pelamar block): Judul lowongan (optional, default the Jabatan name), Tentang pekerjaan (required, min 20, max 4000 letters), Persyaratan (optional). Fields `publicTitle`, `publicDescription`, `publicRequirements` on RecruitmentRequest (migration 20261022090000, additive).
- **A vacancy takes no applicants until the detail is written** (`readinessProblems`: "Detail lowongan belum ditulis."), so it also shows as "Belum siap" on the Beranda. Vacancies already open when this went live were filled from the request's text so nothing changed for applicants.
- The public vacancy list, the public apply page and Lowongan Internal show the written detail. The Pendidikan and Pengalaman lines from the request are no longer shown there (the writer adds them under Persyaratan if wanted).
- **Beranda Admin Rekrutmen: card "Belum dibuka"** lists approved requests not open for applicants (longest waiting first, amber from 3 days, rose from 7, held ones last and greyed), each with "Buka lowongan" to the request page (`buildUnopenedRequests`).
- Note for the BUILD session: the shared database holds the assessment tables of migration 20261021120000_recruitment_assessment_v32 that `main`'s schema does not know yet. `prisma migrate diff` on `main` therefore lists them as drops: never run that output; write additive migrations by hand (as this one was) until that branch is merged.

### Application data, and where a move or a filled position came from (2026-10-22)
- **Every application (external and internal) asks for email, a WhatsApp number, the newest CV (required) and one supporting document (optional).** Two uploads in total, each at most 2 MB (the whole request body may not exceed 4.5 MB, so two files share it; the offering letter, a single file, keeps 4 MB). Same fields in both forms (`applicant-contact-fields.tsx`). The supporting file is `RecruitmentCandidate.supportingFileId`; interviewers and essay reviewers can open it like the CV and the clean-up deletes it with the applicant. Existing applicants keep working without it.
- **One WhatsApp standard** (`mobile-number.ts`, shared by the browser form and the server): typed with 0, +62, 62, spaces, dashes or brackets, it is kept as `62…` and shown as `+62 812-3456-7890` everywhere (applicant page with a Chat WhatsApp and a Salin button, applicant table). Only Indonesian mobile numbers (62 8…, 11 to 14 digits); short, landline and foreign numbers are refused with a reason. The form shows "Akan disimpan sebagai …" while typing.
- **Internal "Lamar" is now a short form** (was one button): email and WhatsApp prefilled from the employee profile, kept for that application only (the profile is not changed), CV required, one optional document. Line managers are still not told.
- **Three ways a position is filled: Rekrutmen eksternal, Rekrutmen internal, Mutasi.** `RecruitmentRequestFulfillment.source`, stamped when the row is created (hire from an external applicant, an internal applicant's move, or a Mutasi that fills the request with no applicant). The request page shows one total ("3 dari 3 terisi") with the three-way detail and a label per person; the Dasbor Rekrutmen has a "Posisi terisi" card with the same detail. Hiring rate and time to hire stay computed from applicants only; a Mutasi never counts there. A source filter on the dashboard hides Mutasi.
- **Every Perubahan Posisi has a fixed origin: Rekrutmen internal or Mutasi** (`MovementRequest.origin`, set when it is filed: from an applicant, or not). A Mutasi that fills a request keeps its link and shows "mengisi REQ-…". Shown as a column and filter in the move list, a banner on the detail page, "Asal" in the employee's placement history, and in the wording of the manager email. Approval chain unchanged.
- **A move from Rekrutmen internal needs no performance evaluation**, whatever its type (the applicant already had tests and an interview); a plain Mutasi already needed none (`movementNeedsEvaluation`).
- Migration 20261022100000 (additive, written by hand; existing moves and filled positions back-filled from their links).

### Tes Situasi Kerja (behavioral risk screening) V3.2 / rubric V3.2-R1 (2026-10-21, BUILD branch, not deployed)
Owner supplied the master data (folder GPT-module: question bank JSON, HR rubric JSON, CSV). Used as the source of truth; nothing was reworded.
- **Source files** are copied unchanged to `src/lib/recruitment-assessment-data/` (git never touches their line endings, `.gitattributes`) and a unit test checks their SHA-256 against `recruitment-assessment-sources.ts`. Validation of the package (20 questions, A-D distinct, 80 interpretations, the approved score matrix, totals 58/14/8, worst case -19) runs before import and again in tests. A mismatch stops the import and is reported; nothing is auto-corrected.
- **Separate tables, not the old test tables.** The existing test catalog is pass/fail by percentage and edits questions in place; this screening needs hidden dimensions, immutable versions and a risk score. New tables `RecruitmentAssessment*` (migration 20261021120000, additive; plus a partial unique index: one ACTIVE rubric per assessment version). Question bank = fixed after import. Rubric = observation + risk signal per option, with a status.
- **Rubric statuses** DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> ARCHIVED. HR Admin edits (draft only) and submits; only an employee on an active HR Manager Position approves or returns (a return needs a reason and makes the rubric a draft again, the history stays). Approving does not make it live: HR Admin or HR Manager then activates it, which archives the rubric in force. Approved content and scores are locked; a change is a new rubric (R2), copied from the old one. Approver, time and every step are kept (`RecruitmentAssessmentRubricEvent`, plus the audit log).
- **Matrix differences are shown, not blocking, after import.** If HR edits a score so it differs from the approved V3.2 matrix, the rubric page shows the difference in red and tells the HR Manager; submitting is still possible, because a deliberate revision (R2) must be allowed. The import itself refuses any difference.
- **Candidate side.** Same private link as the tests (`/cbp-recruitment/asesmen/[token]`); it opens once the gate test (Cultural Fit) is submitted, shows only situation, question and the four choices (no titles, dimensions or scores), saves every choice, needs all 20 answers, and the final submit is claimed with a conditional update so a second click or tab cannot score twice. The attempt is tied to the rubric ACTIVE when it started. It never changes the applicant's status.- **Scoring** (`scoreAssessment`, pure): version + question + option + approved rubric -> observation, signal, dimension; total = sum of the 20; 0..-2 NO_AGGREGATE_CONCERN, -3..-5 INTERVIEW_ATTENTION, <= -6 PRIORITY_REVIEW; incomplete = INCOMPLETE without a score; a draft/pending rubric (or one without an approval record) throws. At scoring every interpretation is copied into `RecruitmentAssessmentResultItem` (question text, option text, dimension, observation, signal, rubric and interpretation ids), so a later rubric never changes a past score.
- **HR view** `/recruitment/assessment/results` (list, filter by screening status, search) and `/results/[candidateId]` (status, score, versions, material concerns on top, all 20 entries expandable with the original question and the chosen answer). Material = a -2 answer or an option flagged `requiresControlReview` (the 8 are exactly the -2 options), shown even when the total is above -6. No personality label, no recommendation; audited VIEW.
- **Access (owner correction 2026-10-21):** Admin Rekrutmen prepares and submits the rubric and reads the scoring; Admin SDM (HR_ADMIN) has NO access to the assessment, its rubric or its results. An employee on an active HR Manager Position approves or returns the rubric and may read the rubric and the results (confirmed by the owner 2026-10-21). Predicates in permissions.ts (`canManageAssessmentRubric`, `canApproveAssessmentRubric`, `canViewAssessmentRubric`, `canViewAssessmentResults`).
- **Internal employees (owner request 2026-10-21):** an internal applicant takes the same assessment, the same page component, scoring and storage as an external one. Like their other tests they are signed in, so the page is `/internal-jobs/asesmen/[candidateId]` (card on their test page) and the server only accepts the employee the applicant belongs to. HR sees "Internal" and the employee's name and number in the result and in the list.
- **Package notes:** 12 questions are RISK type, 8 (Q4, 6, 7, 10, 13, 16, 18, 20) are PREFERENCE (neutral, all options 0). README and validation results named in the hand-over were not in the folder (only the three data files).
- Not built (future milestones): AI report, interview evaluation, HR reasoning editor.
- **30-minute limit and copy protection (owner request 2026-10-21).** The assessment is timed: 30 minutes from the moment the applicant presses Mulai (`ASSESSMENT_TIME_LIMIT_MINUTES`; the server decides, the page only shows a countdown from the server's clock). Answers and question loading are refused after 30 minutes + 20 s grace for slow connections. When the time is over: all 20 answered = scored as usual; fewer = the attempt is **closed without a score** (screening status Belum lengkap, answers kept, HR sees "n of 20 answered"), nothing is guessed. Decision taken here without asking: no automatic second try; HR may reopen by asking the applicant to retake outside this module. Expired attempts are also closed on page open (applicant or HR) and by the nightly job. No migration: the existing INCOMPLETE value and the start time are used.
- **One page (owner request 2026-10-22).** All tests now show every question on one page (Cultural Fit and the other tests of the old pipeline, and Tes Situasi Kerja), answered in any order, with the clock and the progress counter pinned at the top, a list of unanswered numbers that jump to the question, and one Kirim button at the bottom (enabled when everything is answered). Because of this the Tes Situasi Kerja questions are no longer served one by one: all 20 are fetched in one call right after Mulai (still not in the page source before the applicant starts, only with a valid link or sign-in, and only while the attempt is open and in time).
- **Copying.** On screen: text selection, copy, cut, drag, right-click, Ctrl/Cmd C X A P S U and printing are switched off, the content blurs when the tab is left, PrintScreen clears the clipboard, and a faint watermark with the applicant's name covers the question. This deters casual copying and sharing; photographing the screen cannot be prevented by any web page.
- **Time limit is set in the app, copy protection is the same for every test (owner request 2026-10-22).** The Tes Situasi Kerja time limit is no longer fixed: Admin Rekrutmen sets it on Rekrutmen > Rubrik Tes Situasi Kerja ("Waktu pengerjaan", whole minutes 5 to 240, default 30; the HR Manager only sees it). Each attempt stores the limit it started with (`RecruitmentAssessmentSubmission.timeLimitMinutes`), so changing it never moves the clock of someone already working; a change is audited. The other tests (Cultural Fit and the rest) already have their own "Waktu pengerjaan" per test in Pengaturan Rekrutmen > Katalog tes. Additive migration 20261022100000 (two columns with a default of 30). Copy protection moved into one shared wrapper (`src/components/test-protection.tsx`) used by the old tests and by Tes Situasi Kerja alike: selecting, copy, cut, paste, drag, right-click, Ctrl/Cmd C X A P S U, printing, blur when the tab is left, PrintScreen clears the clipboard, and a watermark with the applicant's name. Text boxes (essay answers) stay usable; pasting into them stays blocked.

### Tes Situasi Kerja is the culture fit test and the first test of everyone (owner decision 2026-10-23)
- **Cultural Fit is gone as a test.** It had no questions and nobody had taken it; the owner said Tes Situasi Kerja is the culture fit test. Migration 20261023090000 (data only) switches the old `rtt_cultural_fit` entry off and no longer calls it the gate; nothing is deleted.
- **Order.** Every applicant, external or internal, sees Tes Situasi Kerja as step 1 on the test list (the same list as the other tests, with a Mulai button that opens its own page; "Lanjut" on its finish screen comes back to the list). The vacancy's other tests (Ketelitian, Logika Dasar, Studi Kasus ...) open only after it is finished: `canStartTest(..., assessmentDone)`, checked again on the server in `startCandidateTest`.
- **No pass or fail.** It never rejects anyone. The applicant stays TESTING until it is finished or closed by the clock (`deriveStatusFromTests(tests, assessmentDone)`); a vacancy with no other tests then goes straight to TEST_PASSED. HR still reads the result at Rekrutmen > Rubrik Tes Situasi Kerja > hasil (Admin Rekrutmen and HR Manager). It does not count in "tests passed": a person who finishes it and fails Ketelitian is still "Tidak lolos tes".
- **Time ran out with fewer than 20 answers** (owner accepted the recommendation): the attempt is closed without a score ("Belum lengkap", answers kept) and the other tests still open. Finishing or closing it calls `refreshCandidateStatus` so the status moves on at once.
- **Vacancy readiness** is now "an active Tes Situasi Kerja rubric exists" (`PlanContext.assessment`), not "Cultural Fit has questions". Beranda Rekrutmen shows one warning (not one per vacancy) while no rubric is active. The test ticks on a vacancy and the job-title table show "Tes Situasi Kerja (wajib)" in place of Cultural Fit, and the apply page lists it first with its minutes.
- **Dashboard.** For the stage and "passed" date, Tes Situasi Kerja counts as a test that is passed once finished, so applicants of a vacancy with no other tests still move from "applied" to "tests passed".
- Removed `assessmentEntryState` (the separate card under the test list). `isAssessmentOpenFor` no longer looks at a gate test. Text on the closed page changed accordingly.

### Cetak on Jadwal Shift (owner request 2026-10-23)
- One **Cetak** button on the Jadwal Shift screen, next to "Salin dari minggu lalu". It prints what is on screen: the selected week, the shift button (Semua / Belum diatur / Shift 2 / Shift 3 / Libur), department, group and search. Shift 2 chosen = only the Shift 2 table; Semua = everyone with a Shift column.
- The paper has the company name, "JADWAL SHIFT", the week as dates ("Minggu 18 Okt 2026 – Sabtu 24 Okt 2026"; the company week is Sunday to Saturday), what it was limited to and the head count, then No / Nama / No. Karyawan / Grup / Shift (Grup instead of Departemen, owner 2026-10-23; no Jabatan), and who printed it and when.
- **Unsaved changes:** Cetak asks to save first (owner accepted the recommendation), so paper always equals what is saved. Someone with no stored change prints as Shift 1.
- Browser print only. Everything except the sheet is taken out of the layout with display none (the QR-label trick of visibility hidden left the page height behind and printed many blank pages: 14 pages for 3 of content in a headless Chrome test, 3 pages after the change); no new page, no database change. Access is unchanged: Admin SDM sees everyone, a Level 3 head only their departments. Wording in `src/lib/shift-print.ts` (tested).

### Tes Situasi Kerja score in the applicant table (owner request 2026-10-26)
- The "Hasil tes" column of the Pelamar table (and a request's own applicant table) starts with the Tes Situasi Kerja score only, e.g. "Situasi Kerja -3" (or "belum", "berjalan", "belum lengkap"), then the other tests. No status wording, no concerns; the details stay on the results pages.
- **Access note:** this table is opened by Admin SDM too, so Admin SDM now sees this one number. The results pages, rubric and answers remain Admin Rekrutmen and HR Manager only. The interview page's test summary does not include it.

### Applying with two files failed with "page cannot be loaded" (fix 2026-10-26)
- **Cause (production logs, 18 failures since 23 Oct):** creating an applicant stored the CV and the supporting document inside one interactive database transaction, which expires after 5 seconds ("expired transaction"). Two files of up to 2 MB over the slow database connection took 5.5 to 6.5 seconds, so the transaction was cancelled and the applicant saw an error page. A few failures were the same thing surfacing as a foreign-key error. Nothing half-created was left (checked: no applicant without tests, no orphan file).
- **Fix:** `createCandidate` stores the files first on their own (no transaction), then creates the applicant with its tests as one nested create (atomic by itself); if that fails the stored files are removed. The apply form now shows "Lamaran belum bisa dikirim ... tekan Kirim sekali lagi" instead of an error page when saving fails. The offer-letter upload (4 MB, same pattern) got a 30 s transaction limit.

### New app icon: check mark and the word SAPA (owner choice 2026-10-27)
- The icon of the installed app (phone and computer), the browser tab icon and the iPhone icon are no longer the company logo or the helmet mascot. Owner picked option D2: a white circle with a purple check mark and the word SAPA in white on the SAPA purple.
- Files: `public/pwa/icon-192.png` and `icon-512.png` (rounded, for computers), `public/pwa/maskable-512.png` (artwork at 74 percent so Android's round or squircle crop never cuts the word), `src/app/apple-icon.png` (opaque square, the iPhone rounds it), `src/app/icon.png` and `src/app/favicon.ico` (check mark only, because the word cannot be read at 16 to 48 pixels). The offline cache was renamed to v3 so installed apps drop the old icon.
- The login page mascot and the company logo on the login and recruitment pages are not part of this change.

### Login page: new SAPA icon next to the company name (owner choice 2026-10-27)
- The small yellow speech-bubble mark at the top left of the purple login panel is replaced by the new app icon (check mark and the word SAPA, `/pwa/icon-192.png`). The mascot stays. The CBP logo above the form stays too (owner picked option 3). Same on the sign-in help pages that use the same panel.

### Tambah Posisi: a new kind of Perubahan Posisi (owner request 2026-10-28)
- **What it is.** Jenis perubahan now has **Tambah Posisi** (`MovementType.ADD_POSITION`). Nobody is moved: the employee keeps their placement and also gets one more placement of type Tambahan (ADDITIONAL), starting on the date given.
- **Owner decisions (2026-10-28):** (1) the unit may be in another department; (2) **no Kepala Departemen approval, only the HR Manager** (a new request starts at "Diajukan", `initialMovementStatus`); (3) **the request names a standard Jabatan and a unit, not a position**, because the seat may not exist yet.
- **Flow.** Requester (Level 3 or Admin SDM, as for every Perubahan Posisi) picks the employee, Tambah Posisi, a Jabatan (standard list), a Unit tujuan, a date and a reason. HR Manager approves, returns or rejects. Admin SDM then opens the request, **picks the position** (an existing, not archived position with exactly that Jabatan in that unit, kosong or already held) or first creates it in Struktur Organisasi, and presses Laksanakan; that creates the Additional assignment. Level (Golongan) is set when the position is created, not on the request.
- **Data.** Migrations 20261028090000 (new enum value) and 20261028100000 (two nullable columns `proposedJobId`, `proposedOrgUnitId` on MovementRequest). `proposedPositionId` is still required, so for this type it repeats the current position (same convention as the legacy Perubahan Status); the real seat is stored on the new assignment (`implementedAssignmentId`).
- **Rules decided here without asking (change if wrong):** no evaluation and no level rule (like a Mutasi); one open request per employee still applies; the seat may already have a main holder; refused if the employee already holds that seat; not usable for an internal applicant or to fill a recruitment request; a future start date is stored as an Additional placement with that start date, no scheduling step; the main position and "posisi saat ini" do not change; an Additional placement in a 3B seat gives Kepala Departemen authority for that unit as other additional placements do.
- Hints on the form and the request page explain the steps (`movement.addPositionHint`).

### Perubahan Posisi can be filed from job level 2C (owner request 2026-10-28)
- Who may file a Perubahan Posisi (every type, Tambah Posisi included) is now a holder of a position at **job level 2C or above** (2C, 3A, 3B, 4A, 5A), for employees of their own department. It was 3A and 3B only. Admin SDM can still file for anyone, and Admin Rekrutmen for an internal applicant.
- The rule is `isMovementSubmitLevel` (movement.ts, uses the same level comparison as the Promosi and Demosi direction check). Only Perubahan Posisi uses it: shift schedules, training requests, competency and absence views keep their Level 3 rules (`level3-scope.ts`).
- Department scope is unchanged (the whole department of the position they hold). The approval path is unchanged: Kepala Departemen (3B) then HR Manager, except Tambah Posisi (HR Manager only). A level that cannot be read (not like 2C, 3A ...) does not count.

### Mutasi also names a standard Jabatan and a unit (owner request 2026-10-28)
- **Mutasi works like Tambah Posisi on the request:** the form asks for a **Jabatan (standar)** and a **Unit tujuan** instead of a position, because the seat may not exist yet. Approval is unchanged: Kepala Departemen, then HR Manager. When Admin SDM carries it out, they **pick the seat** (an existing position with exactly that Jabatan in that unit that has no main holder) or first create it in Struktur Organisasi. The usual move then happens: the old main placement ends, the new one starts, and the request shows the real seat afterwards (`proposedPositionId` is updated at execution).
- **Isi dengan Mutasi:** the Jabatan is fixed to the recruitment request's own Jabatan; Admin SDM only picks the unit. The vacant-seat check moves from filing to the moment of carrying it out.
- **Promosi and Demosi still name a position**, because they are checked against the seat's job level (a promotion must go up, a demotion down) and a Jabatan has no level. Say so if they should change too. An internal applicant's move (from Rekrutmen) also still names a position, as the applicant applied to a specific vacancy. Mutasi requests that the renewal flow creates still carry a position and execute as before.
- No new database fields: it reuses `proposedJobId` and `proposedOrgUnitId` from Tambah Posisi.

### Every Perubahan Posisi names a standard Jabatan (owner request 2026-10-28, supersedes the Promosi and Demosi exception above)
- **All four types** (Promosi, Mutasi, Demosi, Tambah Posisi) now ask for a **Jabatan (standar)** and a **Unit tujuan**, not a position. Admin SDM picks (or first creates) the seat when carrying the request out.
- **Promosi and Demosi also ask for "Level yang dituju"** (the level codes that exist, such as 2C or 3A), because a Jabatan has no level and "a promotion goes up, a demotion goes down" is still checked at filing (`validateJobLevelDirection`). At execution the chosen seat must have exactly that level. New nullable column `proposedJobLevel` (migration 20261028110000).
- **An internal applicant's move** (from Rekrutmen) also names a Jabatan, fixed to the vacancy's own Jabatan, plus a unit; Admin Rekrutmen/Admin SDM picks the unit. **Isi dengan Mutasi** works the same (Jabatan fixed to the request's).
- Requests already open, and the Mutasi/Demosi that the contract renewal flow creates, still carry a position and finish the old way.

### No Kepala Departemen approval for any Perubahan Posisi (owner request 2026-10-28)
- A new Perubahan Posisi of **any type** (Promosi, Mutasi, Demosi, Tambah Posisi) starts at "Diajukan" and goes straight to the **HR Manager**, then Admin SDM carries it out. `initialMovementStatus` always returns SUBMITTED. This replaces the Kepala Departemen first step (it was already skipped for Tambah Posisi).
- Promosi and Demosi still need their evaluation completed before the HR Manager can decide. Who may file is unchanged (level 2C and above).
- The Kepala Departemen decision screen is kept only for a request that was already waiting there (none at the time of this change). The Perpanjangan Kontrak flow is separate and keeps its own Kepala Departemen recommendation.

### A replacement can start in the leaver's seat before the last working day (owner request 2026-10-28)
- **The gap:** one seat could have only one main holder, so a replacement could not be placed in the same position until the leaver's placement ended after the last working day (example: Reza Dwika Aulia, QE-ST-002, last day 29 Oct 2026).
- **The rule now:** a seat may take a new main holder while its current holder is **leaving**: an exit case (Offboarding) still waiting for clearance (every case has its last working day; `holderIsLeaving`, and `STAYING_HOLDER` in the database queries). Everyone else keeps the one-holder rule. Two main holders then overlap until the leaver's last day; after it the nightly job deactivates the leaver as before and only the replacement keeps the seat.
- **Where:** every place that checks a seat for a main holder: Buat Karyawan from a recruitment request (the seat list and the vacant-seat counts include such seats), Mutasi/Promosi/Demosi (seat picker and checks), Pindahkan ke Posisi Baru, the placement import, and renewal moves. The pickers label these seats "akan kosong: Nama keluar 29 Okt", and Buat Karyawan shows a short note.
- **Safeguard:** cancelling an exit case is refused while a replacement already holds the leaver's seat as a main holder, with the position and the replacement's name; the replacement must be moved or ended first. No database change.

### Recruitment belongs to Admin Rekrutmen alone (owner request 2026-10-28)
- **Admin SDM no longer has any recruitment access.** `canManageRecruitment` is now only the Admin Rekrutmen role. That removes from Admin SDM: the menu entries Pelamar, Dasbor Rekrutmen and Pengaturan Rekrutmen; the request management (set Jabatan, open, vacancy detail, access code, Tahan/Lanjutkan, Kurangi jumlah, Tutup, Batalkan, resubmit, edit, filing on someone's behalf); everything about applicants (tests, essay review, interviews, offers, "Akhiri proses", clean-up of old applicants, CV files); the question banks and settings; and "Isi dengan Mutasi". The emails about request changes go to the requester, the HR Manager and Admin Rekrutmen.
- **Owner answers:** (1) the owner's own login stays Admin SDM only, no Admin Rekrutmen role added, the Admin Rekrutmen login is used for recruitment; (2) **both admins may create an employee from an approved request**; (3) as recommended: **Admin Rekrutmen files "Isi dengan Mutasi" and carries it out**, Admin SDM keeps every other Perubahan Posisi; (4) recruitment figures are removed from Admin SDM's views (the HR Reports page was only a placeholder and its text no longer lists recruitment; the Beranda rows and the "no vacant seat for a ready request" warnings are gone).
- **What Admin SDM still sees:** the request list shows only approved requests that can still be filled, and an approved request opens in a short view with "Buat Karyawan" and the applicants who accepted their offer (each with its own Buat Karyawan button, which keeps the applicant linked). Nothing else on the request or the applicant is visible. Admin SDM can still create an employee directly from Data Karyawan.
- **Admin Rekrutmen needs to carry out Perubahan Posisi that fill their work,** but cannot open the Mutasi page: the approved internal applicant's move (applicant page) and the Mutasi that fills a request (request page) now show the seat picker and the Laksanakan button there (`ExecuteAddPositionForm`, shared seat list in `src/lib/movement-seats.ts`). This also fixes the internal applicant's move, which would have failed after Perubahan Posisi began naming a Jabatan instead of a position.
- **Roles are still managed by Admin SDM** (Akun Admin Rekrutmen page). Who may file a recruitment request: any employee-linked account, and Admin Rekrutmen (on behalf of someone). Cancel a request: the requester, the HR Manager or Admin Rekrutmen. No database change.

### Email to applicants is switched off for now (owner request 2026-10-28)
- Admin Rekrutmen can no longer send any email to an applicant. The two emails that went to applicants are off: the **interview invitation** (when an interview is scheduled) and the **offering-letter link** (when the offer is sent). Both now go through `trySendToApplicant` (`recruitment-flow.ts`), which sends nothing while `APPLICANT_EMAILS_ENABLED` (`src/lib/applicant-email.ts`) is `false`.
- Nothing else breaks: the interview is still saved, the offer link is still created, and the screen says "Email ke pelamar sedang dinonaktifkan" and offers the WhatsApp message and the link to copy, as it already did when an email failed. The test link of a new applicant was never emailed.
- **Not affected:** emails to staff (interviewers and essay reviewers told of an assignment, the HR Manager, the requester, managers told of an internal move) and the login invitations and password resets that Admin SDM sends to employees.
- **To switch it on later,** change the one value in `applicant-email.ts` to `true` and deploy.

### Seat picker includes seats below the unit, and Kosong/Terisi is updated after a move (fix 2026-10-28)
- **MOV-2026-0004 could not pick a seat.** It named the Jabatan "Staff Sales" in the department "Sales & Marketing", but the seats of that Jabatan sit in the Section "Sales" below it, and the picker only matched the unit itself. "In that unit" now means the unit or anywhere below it (same rule as the seats of a recruitment request); the picker label shows the seat's own unit, and carrying it out accepts such a seat.
- **RI-ST-001 still showed Kosong and QE-ST-003 Terisi after MOV-2026-0003 was carried out.** The move itself was saved correctly (Muhammad Ridwan holds RI-ST-001, his QE-ST-003 placement ended). Only the stored Kosong/Terisi label was wrong: it was recomputed inside the same database transaction, before the new placement was saved. It is now recomputed right after the move is saved (also for Tambah Posisi). The stale labels already in the data were repaired by recomputing every position from its placements.

### Perubahan Posisi names only the Jabatan; no unit (owner request 2026-10-28, supersedes "Jabatan and unit")
- **The "Unit tujuan" field is gone** from every Perubahan Posisi type. The request names the standard Jabatan (and, for Promosi and Demosi, the level). **Admin SDM works out which seat, in which department,** when carrying it out: the picker lists every seat of that Jabatan in any unit (each labelled with its own unit; empty seats for a Mutasi, Promosi and Demosi, any seat for Tambah Posisi), or Admin SDM first creates the seat in Struktur Organisasi.
- No check of the department against the Jabatan any more, at filing or at carrying out; only that the seat has the approved Jabatan (and level, for Promosi/Demosi). The older `proposedOrgUnitId` column stays in the data but is no longer read or filled (MOV-2026-0004 carries one and ignores it).

### Beranda Admin Rekrutmen rebuilt around "what to do" and "progress" (2026-10-28)
- **Owner's complaint:** the old Beranda (six count tiles, one long "Perlu ditindak" list) did not help the day's work and showed no progress.
- **Now:** four numbers (to do, interviews in 7 days, waiting for others, seats filled); "Kerjakan sekarang" grouped into Siapkan lowongan, Seleksi pelamar, Interview, Offering & penerimaan, Perpindahan internal (oldest wait first, 5 rows per group in "Semua", filter chips per group); progress card per approved request (applicants now in each step, seats filled of needed, one "Langkah berikutnya" line); "Interview 7 hari ke depan"; "Menunggu pihak lain" (offering not answered, interviewer has not filled the form, essay reviewer, applicant still testing, Perubahan Posisi awaiting approval); the 30-day summary stays; setup warnings became one yellow banner on top.
- **Removed from the Beranda:** the six tiles, the "Belum dibuka" card (an approved request that is not open is now a "Siapkan lowongan" to-do), the "Lowongan dibuka" card (replaced by the progress cards). A scheduled interview is no longer a to-do row (it is in the interview card).
- **Data only:** no migration. Reads the same tables as before plus one count of applicants per request and the interview mode.

### Pengaturan Tes shows each question as the applicant reads it (2026-10-28)
- The question list in Pengaturan Rekrutmen > a test used plain text, so line breaks, a lone "," line or the monospace font were invisible to HR. Each question now shows as a preview card (same fonts, line breaks and answer controls as the test page); the correct answer of a multiple-choice question stays visible to HR only, under the card.
- "Ubah soal" and "Tambah satu soal" show the preview beside the fields and update while typing, with a short warning for lines that hold only punctuation and for doubled "??" / "!!" (`src/lib/question-format.ts`).
- The "Keterangan" field of a test is what applicants read in the yellow box before the test; its label now says so. No migration, no change to the applicant pages.

### Recruitment gap fixes REC-5, 6, 7, 11, 12, 13 (2026-10-28)
- **REC-6:** Admin Rekrutmen can issue a new private test link for an external applicant who is still testing (the old link stops, shown once with copy and WhatsApp; the link does not touch any test) and can reopen a test whose time ran out and was handed in by the clock (answers cleared, full time again, reason required and audited). A test the applicant handed in themselves is never reopened. The apply action also emails the link while applicant email is on.
- **REC-12:** "Akhiri proses" has two choices: Ditolak (waits before applying again) or the new status Mengundurkan diri (WITHDRAWN: no waiting, not counted as a rejection). Migration 20261028120000 adds the enum value and the nullable column `closureNotifiedAt`.
- **REC-7:** Closing or cancelling a request closes the applicants still in the pipeline (Tidak terpilih, no waiting, offer links off, an open Perubahan Posisi cancelled), with a preview before and an optional list "Pelamar yang ditutup bersama permintaan" (WhatsApp + "Tandai sudah dikabari"), never a to-do. A warning shows when the last seat is about to fill while other applicants are still running.
- **REC-11:** the active HR Manager may also set the standard Jabatan before approving (Admin Rekrutmen keeps it, and alone may change it after approval).
- **REC-5:** ending an applicant, or closing the rest of a request, also cancels that applicant's open Perubahan Posisi. It only exists after the interview accepted an internal applicant.
- **REC-13:** cancelling a scheduled placement that was counted as filling a request reverses the filling, reopens the request, closes the internal applicant whose move it was and notifies the request parties. Applicants closed earlier because the seat looked full stay closed (their previous step is not kept); they show in the optional list.
- **REC-9 and REC-10:** kept as they are, by the owner.

### Applicant data kept 180 days, dashboard numbers unchanged after a clean-up (REC-14, 2026-10-28)
- **Decision:** applicants who left without being hired are eligible for the manual clean-up after **180 days** (was 30). Applicants who became employees are never deleted.
- **Dashboard stays the same:** the clean-up writes one row per deleted applicant to `RecruitmentCandidateArchive` first (request, source, status, how far they got, applied / passed / invited / closed dates; no name, email, phone, CV or answers). The dashboard and the Beranda 30-day summary read these rows together with the live applicants, and a test checks the funnel is identical before and after.
- **Keep period >= waiting period:** Pengaturan Rekrutmen refuses a keep period shorter than the re-apply wait, since deleting the rejection also deletes the wait.
- Migration 20261028130000: one new table, and the stored 30-day setting moves to 180 (only if it was still 30). The clean-up itself stays manual, with its preview.
