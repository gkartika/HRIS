# Technical & Product Decisions

Material decisions made while building this app, in addition to the Decision
Log tab (16 Decisions) in the HR App Build Guide. Newest first.

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
