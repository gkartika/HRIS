# Technical & Product Decisions

Material decisions made while building this app, in addition to the Decision
Log tab (16 Decisions) in the HR App Build Guide. Newest first.

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
