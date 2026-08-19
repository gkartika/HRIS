// One-time UAT top-up (2026-08-18) — every workflow-status table already had
// real seed/demo data, but several modules had drifted to all-terminal
// states after repeated build-verification passes (nothing left pending for
// a fresh UAT tester to act on). This adds exactly one fresh record per
// thin module, each left at the EARLIEST actionable stage — so the tester
// walks the real transitions themselves (Dept Head approve -> HR Manager
// decide -> HR Admin execute, etc.) rather than finding it pre-completed.
//
// Also corrects a stale finding from the same audit: the login page's demo
// account list (budi.manager@cbp.demo / siti.karyawan@cbp.demo /
// made.wirawan@cbp.demo) referenced accounts that no longer exist after the
// real-data migration — see login-form.tsx, fixed in the same commit as
// this script.
//
// Does NOT touch: Employee/OrgUnit/Job/Position/Assignment master data (the
// real migrated company roster), or the Audit Log (left alone per explicit
// user decision).
import { prisma } from "../src/lib/db";
import { formatRequestNumber, initialRecruitmentStatus } from "../src/lib/recruitment";
import { formatTrainingRequestNumber } from "../src/lib/training";
import { formatWorkOrderNumber } from "../src/lib/ga-operations";
import { initialOffboardingCaseStatus, formatOffboardingCaseNumber } from "../src/lib/offboarding";
import { logAudit } from "../src/lib/audit";

async function main() {
  const hrAdmin = await prisma.account.findFirstOrThrow({ where: { usernameOrEmail: "hr.admin@cbp.demo" } });
  const gaAdmin = await prisma.account.findFirstOrThrow({ where: { usernameOrEmail: "ga.admin@cbp.demo" } });

  const ahmadi = await prisma.employee.findFirstOrThrow({
    where: { employeeNumber: "EMP-0011" },
    include: { account: true, currentPosition: { include: { job: true, orgUnit: true } } },
  });
  if (!ahmadi.account) throw new Error("AHMADI (EMP-0011) has no linked account");

  // ---------- 1. Training Request: SUBMITTED ----------
  // AHMADI self-submits — Dept Head (SUHARTONO) then approves, Training
  // Admin then validates/schedules. Exercises both thin roles at once.
  const trnYear = new Date().getFullYear();
  const trnCount = await prisma.trainingRequest.count({ where: { requestNumber: { startsWith: `TRN-${trnYear}-` } } });
  const trainingRequest = await prisma.trainingRequest.create({
    data: {
      requestNumber: formatTrainingRequestNumber(trnCount + 1, trnYear),
      requesterType: "SELF",
      employeeId: ahmadi.id,
      submittedByAccountId: ahmadi.account.id,
      departmentIdSnapshot: ahmadi.currentPosition?.orgUnitId ?? null,
      positionIdSnapshot: ahmadi.currentPositionId,
      reason: "Peningkatan kompetensi teknis untuk mendukung target produksi kuartal berjalan.",
      requestedTopic: "Pelatihan Lean Manufacturing & 5S",
      businessJustification: "Mendukung inisiatif efisiensi lini Forming.",
      preferredTiming: "Kuartal berikutnya",
      status: "SUBMITTED",
    },
  });
  await logAudit({
    actorAccountId: ahmadi.account.id,
    action: "CREATE",
    datasetName: "TrainingRequest",
    recordId: trainingRequest.id,
    reason: `[UAT top-up] Submitted training request ${trainingRequest.requestNumber} for ${ahmadi.fullLegalName}`,
  });
  console.log("Created TrainingRequest", trainingRequest.requestNumber, "(SUBMITTED)");

  // ---------- 2. Maintenance Work Order: OPEN ----------
  // Fresh preventive work order on an in-use laptop — GA Admin executes it.
  const laptop = await prisma.fixedAsset.findFirstOrThrow({ where: { assetCode: "AST-LAPTOP-001" } });
  const woYear = new Date().getFullYear();
  const woCount = await prisma.maintenanceWorkOrder.count({ where: { workOrderNumber: { startsWith: `WO-${woYear}-` } } });
  const workOrder = await prisma.maintenanceWorkOrder.create({
    data: {
      workOrderNumber: formatWorkOrderNumber(woCount + 1, woYear),
      assetId: laptop.id,
      sourceType: "PREVENTIVE",
      workType: "INTERNAL",
      checklistNotes: "Servis rutin tahunan — pembersihan, cek baterai, update sistem.",
      createdByAccountId: gaAdmin.id,
    },
  });
  await logAudit({
    actorAccountId: gaAdmin.id,
    action: "CREATE",
    datasetName: "MaintenanceWorkOrder",
    recordId: workOrder.id,
    reason: `[UAT top-up] ${workOrder.workOrderNumber} created (preventive)`,
  });
  console.log("Created MaintenanceWorkOrder", workOrder.workOrderNumber, "(OPEN)");

  // ---------- 3. Recruitment Request: PENDING_DEPT_HEAD ----------
  // AHMADI (Team Leader, not a Dept Head) requests one more Operator Forming
  // headcount for his team — Dept Head, then HR Manager, then HR Admin all
  // get a real turn during UAT.
  const operatorForming = await prisma.job.findFirstOrThrow({ where: { jobTitle: { contains: "Operator Forming" } } });
  const recYear = new Date().getFullYear();
  const recCount = await prisma.recruitmentRequest.count({ where: { requestNumber: { startsWith: `REQ-${recYear}-` } } });
  const initialStatus = initialRecruitmentStatus(false); // AHMADI is not a Dept Head
  const recruitmentRequest = await prisma.recruitmentRequest.create({
    data: {
      requestNumber: formatRequestNumber(recCount + 1, recYear),
      requestDate: new Date(),
      reasonCode: "ADDITIONAL",
      departmentId: ahmadi.currentPosition!.orgUnitId,
      jobId: operatorForming.id,
      shiftCode: "SHIFT",
      requestedHeadcount: 1,
      jobDescriptionSnapshot: "Operator lini Forming (Forging) — shift bergilir, target produksi harian.",
      educationRequirementCode: "SMA",
      workExperienceBand: "NONE",
      ageBand: "AGE_18_25",
      requestedJobLevel: "STAFF_OPERATOR",
      status: initialStatus,
      requesterEmployeeId: ahmadi.id,
      requesterPositionId: ahmadi.currentPositionId,
      submittedAt: new Date(),
      submittedByAccountId: ahmadi.account.id,
    },
  });
  await logAudit({
    actorAccountId: ahmadi.account.id,
    action: "CREATE",
    datasetName: "RecruitmentRequest",
    recordId: recruitmentRequest.id,
    reason: `[UAT top-up] Submitted recruitment request ${recruitmentRequest.requestNumber} for 1 position(s)`,
  });
  console.log("Created RecruitmentRequest", recruitmentRequest.requestNumber, `(${initialStatus})`);

  // ---------- 4. Offboarding Case (resignation): PENDING_DEPT_HEAD ----------
  // ABDUL MUHIDIN (EMP-0002, Production, no active case) — Dept Head, HR
  // Manager, then HR Admin's exit clearance all get exercised.
  const abdulMuhidin = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: "EMP-0002" } });
  const existingCase = await prisma.offboardingCase.findFirst({
    where: { employeeId: abdulMuhidin.id, status: { in: ["PENDING_DEPT_HEAD", "PENDING_HR_MANAGER", "PENDING_CLEARANCE"] } },
  });
  if (existingCase) {
    console.log("Skipped OffboardingCase — active case already exists:", existingCase.caseNumber);
  } else {
    const ofbYear = new Date().getFullYear();
    const ofbCount = await prisma.offboardingCase.count({ where: { caseNumber: { startsWith: `OFB-${ofbYear}-` } } });
    const lastWorkingDay = new Date();
    lastWorkingDay.setDate(lastWorkingDay.getDate() + 30);
    const offboardingCase = await prisma.offboardingCase.create({
      data: {
        caseNumber: formatOffboardingCaseNumber(ofbCount + 1, ofbYear),
        employeeId: abdulMuhidin.id,
        reason: "RESIGNATION",
        status: initialOffboardingCaseStatus("RESIGNATION"),
        lastWorkingDay,
        clearanceDueDate: lastWorkingDay,
        reportedByAccountId: hrAdmin.id,
        managerNote: "Mengundurkan diri untuk melanjutkan pendidikan.",
      },
    });
    await logAudit({
      actorAccountId: hrAdmin.id,
      action: "CREATE",
      datasetName: "OffboardingCase",
      recordId: offboardingCase.id,
      reason: `[UAT top-up] ${offboardingCase.caseNumber} reported (reason: RESIGNATION)`,
    });
    console.log("Created OffboardingCase", offboardingCase.caseNumber, `(${offboardingCase.status})`);
  }

  console.log("\nUAT top-up complete.");
}

main().finally(() => prisma.$disconnect());
