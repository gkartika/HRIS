"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { createOffboardingCaseInternal } from "@/lib/offboarding-create";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canStartOffboarding,
  canExecuteExitClearance,
  canCancelOffboardingCase,
  canSubmitExitClearanceForm,
  canConfirmGaAssetClearance,
} from "@/lib/permissions";
import { formFail, type FormState } from "@/lib/form-state";
import { logAudit } from "@/lib/audit";
import { syncPositionStatus } from "@/lib/position-occupancy";
import {
  canExecuteExitClearanceStatus,
  canCancelOffboardingCaseStatus,
  isPastLastWorkingDay,
  parseExitReturnCondition,
  type ExitReturnOutcome,
} from "@/lib/offboarding";
import { companyToday } from "@/lib/company-time";
import { deactivateEmployee } from "@/lib/offboarding-deactivate";
import { createDisposalCaseInternal } from "@/lib/disposal-create";
import { openRepairForReturnedAsset } from "@/lib/maintenance-create";
import { blocksOffboarding, computeAvailableQuantityAfterReturn } from "@/lib/assets";
import { blocksOffboardingGaRequest } from "@/lib/ga-operations";


// HR Admin alone opens a resignation case — no approval stage follows.
export async function startOffboarding(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  if (!canStartOffboarding(session)) {
    return formFail(formData, "Anda tidak memiliki akses. Hanya Admin SDM yang dapat memulai Offboarding.");
  }

  const employeeId = formData.get("employeeId") as string;
  const lastWorkingDay = formData.get("lastWorkingDay") as string;
  const managerNote = (formData.get("managerNote") as string)?.trim() || null;
  const exitReasonId = (formData.get("exitReasonId") as string) || "";

  if (!employeeId || !lastWorkingDay) {
    return formFail(formData, "Karyawan dan Hari Kerja Terakhir wajib diisi.", !employeeId ? "employeeId" : "lastWorkingDay");
  }
  const exitReason = exitReasonId
    ? await prisma.offboardingReasonOption.findFirst({ where: { id: exitReasonId, activeFlag: true } })
    : null;
  if (!exitReason) return formFail(formData, "Pilih Alasan yang masih aktif.", "exitReasonId");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return formFail(formData, "Karyawan tidak ditemukan.", "employeeId");

  const existingActiveCase = await prisma.offboardingCase.findFirst({
    where: { employeeId, status: "PENDING_CLEARANCE" },
  });
  if (existingActiveCase) {
    return formFail(formData, `Karyawan ini sudah memiliki kasus Offboarding aktif (${existingActiveCase.caseNumber}).`, "employeeId");
  }

  const created = await createOffboardingCaseInternal({
    employeeId,
    reason: "RESIGNATION",
    lastWorkingDay: new Date(lastWorkingDay),
    reportedByAccountId: session.user.id,
    managerNote,
    exitReasonId: exitReason.id,
  });

  revalidatePath("/offboarding");
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/offboarding/${created.id}`);
}

// LIF-06/LIF-07/GA-05: "HR Admin exit-clearance execution > Account
// Disable" — one combined action (nothing in the spec describes an
// intermediate gate between them). Closes (never deletes) every ACTIVE
// Assignment as of the case's last working day, per LIF-07's "does not
// remove historical records." Phase 4A: "Only open Employee custody blocks
// offboarding" is now a real DB-backed check (blocksOffboarding below) —
// Department/Location custody never blocks, matching the workflow spec.
export async function executeExitClearance(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canExecuteExitClearance(session)) return t("common.forbidden");

  const offboardingCase = await prisma.offboardingCase.findUnique({
    where: { id: caseId },
    include: { employee: { include: { account: true } } },
  });
  if (!offboardingCase) return "Kasus tidak ditemukan.";
  if (!canExecuteExitClearanceStatus(offboardingCase.status)) {
    return "Kasus ini sudah selesai atau dibatalkan.";
  }

  const openEmployeeCustodies = await prisma.assetCustody.findMany({
    where: { employeeId: offboardingCase.employeeId, status: { not: "RETURNED" } },
    include: { asset: { select: { assetName: true, assetCode: true } } },
  });
  const blockingCustodies = openEmployeeCustodies.filter((c) => blocksOffboarding("EMPLOYEE", c.status));

  // Phase 4B: an unresolved Damage/Loss GA request the employee reported
  // also blocks clearance — same "asset accountability isn't settled yet"
  // reasoning as the custody check above, but catches the case where the
  // reported asset isn't (or is no longer) in the employee's own custody.
  const openGaRequests = await prisma.gaRequest.findMany({
    where: { requesterEmployeeId: offboardingCase.employeeId },
    include: { asset: { select: { assetName: true, assetCode: true } } },
  });
  const blockingGaRequests = openGaRequests.filter((r) => blocksOffboardingGaRequest(r.requestType, r.status));

  if (blockingCustodies.length > 0 || blockingGaRequests.length > 0) {
    const parts: string[] = [];
    if (blockingCustodies.length > 0) {
      const assetList = blockingCustodies.map((c) => `${c.asset.assetName} (${c.asset.assetCode})`).join(", ");
      parts.push(`aset yang belum dikembalikan: ${assetList}`);
    }
    if (blockingGaRequests.length > 0) {
      const requestList = blockingGaRequests
        .map((r) => `${r.requestNumber}${r.asset ? ` — ${r.asset.assetName} (${r.asset.assetCode})` : ""}`)
        .join(", ");
      parts.push(`permintaan GA yang belum selesai: ${requestList}`);
    }
    return `Clearance keluar diblokir — masih ada ${parts.join("; ")}. GA Admin harus menyelesaikan ini terlebih dahulu.`;
  }

  // Version after UAT: GA Admin's own explicit checklist sign-off is a
  // required precondition alongside the automatic checks above — even once
  // the DB shows everything returned, GA Admin must still actively confirm
  // it (see confirmGaAssetClearance below).
  if (!offboardingCase.gaAssetClearanceConfirmedAt) {
    return "Clearance keluar diblokir — Admin GA belum mengonfirmasi checklist pengembalian aset.";
  }

  const clearanceNote = (formData.get("clearanceNote") as string)?.trim() || null;

  // The employee keeps their placements and login through the last working
  // day (decided 2026-10-08). Clearance done early only completes the case;
  // the nightly job deactivates them once that day has passed. Done after the
  // last day, the employee is deactivated right here.
  const deactivateNow = isPastLastWorkingDay(offboardingCase.lastWorkingDay, companyToday());

  const deactivation = await prisma.$transaction(async (tx) => {
    const result = deactivateNow
      ? await deactivateEmployee(tx, { employeeId: offboardingCase.employeeId, lastWorkingDay: offboardingCase.lastWorkingDay })
      : { positionIds: [] as string[], accountDisabled: false };

    await tx.offboardingCase.update({
      where: { id: caseId },
      data: {
        status: "COMPLETED",
        clearanceCompletedAt: new Date(),
        clearanceCompletedByAccountId: session.user.id,
        clearanceNote,
      },
    });
    return result;
  });

  for (const positionId of deactivation.positionIds) {
    await syncPositionStatus(positionId);
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OffboardingCase",
    recordId: caseId,
    reason: deactivateNow
      ? `${offboardingCase.caseNumber}: exit clearance completed, ${deactivation.positionIds.length} assignment(s) ended${deactivation.accountDisabled ? ", account disabled" : ""}`
      : `${offboardingCase.caseNumber}: exit clearance completed before the last working day; employee is deactivated automatically after it`,
  });

  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath("/offboarding");
  revalidatePath(`/employees/${offboardingCase.employeeId}`);
  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath("/team");
}

// HR Admin only; available while the case is still pending clearance.
export async function cancelOffboardingCase(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const offboardingCase = await prisma.offboardingCase.findUnique({ where: { id: caseId } });
  if (!offboardingCase) return "Kasus tidak ditemukan.";

  if (!canCancelOffboardingCase(session)) {
    return "Anda tidak memiliki akses untuk membatalkan kasus ini.";
  }
  if (!canCancelOffboardingCaseStatus(offboardingCase.status)) {
    return "Kasus yang sudah selesai atau dibatalkan tidak dapat dibatalkan lagi.";
  }

  const cancellationReason = (formData.get("cancellationReason") as string)?.trim();
  if (!cancellationReason) return "Alasan pembatalan wajib diisi.";

  await prisma.offboardingCase.update({
    where: { id: caseId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByAccountId: session.user.id,
      cancellationReason,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OffboardingCase",
    recordId: caseId,
    reason: `${offboardingCase.caseNumber} cancelled: ${cancellationReason}`,
  });

  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath("/offboarding");
}

// Version after UAT: employee-facing Exit Clearance form — self-service,
// one submission per case, informational only (does not gate
// executeExitClearance above). Questions come from the HR-Admin-maintained
// ExitClearanceQuestion list (src/app/(app)/admin/exit-clearance-questions).
export async function submitExitClearanceForm(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const offboardingCase = await prisma.offboardingCase.findUnique({ where: { id: caseId } });
  if (!offboardingCase) return "Kasus tidak ditemukan.";
  if (!canSubmitExitClearanceForm(session, offboardingCase.employeeId)) {
    return "Anda tidak memiliki akses untuk mengisi formulir ini.";
  }
  if (offboardingCase.status !== "PENDING_CLEARANCE") {
    return "Formulir ini hanya dapat diisi saat kasus menunggu Exit Clearance.";
  }

  const existing = await prisma.exitClearanceSubmission.findUnique({ where: { offboardingCaseId: caseId } });
  if (existing) return "Formulir ini sudah pernah diisi dan tidak dapat diubah.";

  const questions = await prisma.exitClearanceQuestion.findMany({ where: { activeFlag: true } });

  await prisma.$transaction(async (tx) => {
    const submission = await tx.exitClearanceSubmission.create({
      data: { offboardingCaseId: caseId, employeeId: offboardingCase.employeeId },
    });
    for (const question of questions) {
      const answerText = (formData.get(`question-${question.id}`) as string)?.trim() || null;
      await tx.exitClearanceAnswer.create({
        data: { submissionId: submission.id, questionId: question.id, answerText },
      });
    }
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "ExitClearanceSubmission",
    recordId: caseId,
    reason: `${offboardingCase.caseNumber}: employee submitted Exit Clearance form`,
  });

  revalidatePath(`/offboarding/${caseId}`);
}

// Version after UAT: GA Admin's explicit sign-off that every asset/GA
// request tied to the employee has been returned/closed — required
// alongside (not instead of) the automatic checks in executeExitClearance
// above. Re-verifies server-side rather than trusting the client-rendered
// gate on the asset-clearance page.
//
// Per direct follow-up request: one click here also bulk-returns every
// outstanding AssetCustody for the employee (same effect as processing each
// one individually via returnAssetCustody in the Assets module) — GA Admin
// no longer has to visit each asset's own page first. Each asset's actual
// condition is picked here (not assumed Good — see the confirm form), same
// three options and side effects as the single-asset return flow.
// Open GaRequests (damage/loss/disposal-type investigations) are NOT
// auto-resolved this way — those need an actual decision, not a bulk
// rubber-stamp — so if any remain after the bulk return, the checklist
// confirmation itself is withheld until GA Admin resolves those individually.
export async function confirmGaAssetClearance(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canConfirmGaAssetClearance(session)) return t("common.forbidden");

  const offboardingCase = await prisma.offboardingCase.findUnique({
    where: { id: caseId },
    include: { employee: { select: { fullLegalName: true, employeeNumber: true } } },
  });
  if (!offboardingCase) return "Kasus tidak ditemukan.";

  const openCustodies = await prisma.assetCustody.findMany({
    where: { employeeId: offboardingCase.employeeId, status: { not: "RETURNED" } },
    include: { asset: true },
  });
  const blockingCustodies = openCustodies.filter((c) => blocksOffboarding("EMPLOYEE", c.status));

  const outcomeByCustodyId = new Map<string, ExitReturnOutcome>();
  for (const custody of blockingCustodies) {
    const outcome = parseExitReturnCondition(formData.get(`inspectionResult-${custody.id}`) as string);
    if (!outcome) {
      return `Pilih kondisi pengembalian untuk ${custody.asset.assetName} (${custody.asset.assetCode}).`;
    }
    outcomeByCustodyId.set(custody.id, outcome);
  }

  if (blockingCustodies.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const custody of blockingCustodies) {
        const outcome = outcomeByCustodyId.get(custody.id)!;
        const inspectionResult = outcome.inspectionResult;
        await tx.assetCustody.update({
          where: { id: custody.id },
          data: {
            status: "RETURNED",
            returnedAt: new Date(),
            returnedByAccountId: session.user.id,
            returnConditionNote: "Dikembalikan melalui konfirmasi massal di Klirens Aset Offboarding.",
            inspectionResult,
          },
        });
        if (custody.asset.trackingType === "INDIVIDUAL") {
          await tx.fixedAsset.update({
            where: { id: custody.assetId },
            data: { status: outcome.assetStatus },
          });
        } else {
          await tx.fixedAsset.update({
            where: { id: custody.assetId },
            data: {
              availableQuantity: computeAvailableQuantityAfterReturn(
                custody.asset.availableQuantity ?? 0,
                custody.quantity,
                inspectionResult
              ),
            },
          });
        }
      }
    });

    // A lost or beyond-repair asset is not written off here. It gets a
    // disposal proposal (Draft) that goes through the normal approval, the
    // same as a confirmed GA loss or a work order that ends beyond repair.
    // Quantity-tracked items have no per-unit asset record to dispose of.
    // An asset returned as needing repair gets its corrective work order straight away.
    for (const custody of blockingCustodies) {
      const outcome = outcomeByCustodyId.get(custody.id)!;
      if (outcome.condition !== "NEEDS_REPAIR" || custody.asset.trackingType !== "INDIVIDUAL") continue;
      await openRepairForReturnedAsset({
        assetId: custody.assetId,
        createdByAccountId: session.user.id,
        note: `Dikembalikan perlu perbaikan saat klirens aset ${offboardingCase.caseNumber}.`,
      });
    }

    let disposalDrafts = 0;
    for (const custody of blockingCustodies) {
      const outcome = outcomeByCustodyId.get(custody.id)!;
      if (!outcome.disposalReason || custody.asset.trackingType !== "INDIVIDUAL") continue;
      const alreadyOpen = await prisma.disposalCase.findFirst({
        where: { assetId: custody.assetId, status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
        select: { id: true },
      });
      if (alreadyOpen) continue;
      await createDisposalCaseInternal({
        assetId: custody.assetId,
        reason: outcome.disposalReason,
        createdByAccountId: session.user.id,
        proposalNote: `Dikembalikan ${outcome.condition === "LOST" ? "hilang" : "rusak berat"} saat klirens aset ${offboardingCase.caseNumber} (${offboardingCase.employee.fullLegalName}, ${offboardingCase.employee.employeeNumber}).`,
      });
      disposalDrafts += 1;
    }

    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "AssetCustody",
      recordId: caseId,
      reason: `${offboardingCase.caseNumber}: bulk-returned ${blockingCustodies.length} asset custody record(s) via Klirens Aset Offboarding${disposalDrafts > 0 ? `; ${disposalDrafts} disposal proposal(s) drafted` : ""}`,
    });
  }

  const openGaRequests = await prisma.gaRequest.findMany({
    where: { requesterEmployeeId: offboardingCase.employeeId },
  });
  const blockingGaRequests = openGaRequests.filter((r) => blocksOffboardingGaRequest(r.requestType, r.status));
  if (blockingGaRequests.length > 0) {
    revalidatePath("/offboarding/asset-clearance");
    revalidatePath(`/employees/${offboardingCase.employeeId}`);
    revalidatePath("/assets");
    return `${blockingCustodies.length > 0 ? "Aset berhasil dikembalikan, tetapi masih" : "Masih"} ada ${blockingGaRequests.length} permintaan GA yang harus diselesaikan satu per satu sebelum checklist dapat dikonfirmasi.`;
  }

  const gaAssetClearanceNote = (formData.get("gaAssetClearanceNote") as string)?.trim() || null;

  await prisma.offboardingCase.update({
    where: { id: caseId },
    data: {
      gaAssetClearanceConfirmedAt: new Date(),
      gaAssetClearanceConfirmedById: session.user.id,
      gaAssetClearanceNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OffboardingCase",
    recordId: caseId,
    reason: `${offboardingCase.caseNumber}: GA Admin confirmed asset return checklist${blockingCustodies.length > 0 ? ` (bulk-returned ${blockingCustodies.length} asset(s))` : ""}`,
  });

  revalidatePath("/offboarding/asset-clearance");
  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath(`/employees/${offboardingCase.employeeId}`);
  revalidatePath("/assets");
  revalidatePath("/disposal-cases");
}
