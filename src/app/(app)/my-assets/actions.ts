"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/lib/i18n/id";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canSubmitGaRequest } from "@/lib/permissions";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { formatGaRequestNumber } from "@/lib/ga-operations";
import { OPEN_REPORT_STATUSES, formatLossDate, validateRequestText } from "@/lib/ga-request-rules";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { getExtension, validateDocumentFile } from "@/lib/validation/employee-fields";
import type { GaRequestType, GaRequestUrgency } from "@/generated/prisma/enums";

export type MyRequestKind = "NEED" | "DAMAGE" | "LOSS";
export type MyRequestState = { error?: string; done?: string } | undefined;

const TYPE_BY_KIND: Record<MyRequestKind, GaRequestType> = {
  NEED: "NEW_ASSET_NEED",
  DAMAGE: "DAMAGE_OR_ABNORMAL_CONDITION",
  LOSS: "LOSS",
};

// The one way an employee sends a GA request, from Perlengkapan Saya:
//   NEED    a new asset: only a description and an urgency, no asset and no location.
//   DAMAGE  a held asset is damaged: the person writes what is damaged and how it happened.
//   LOSS    a held asset is lost: the person writes the chronology.
// A damage or loss report can only be about an asset the person holds right now, and an asset
// that already has an open report cannot be reported again.
export async function submitMyRequest(
  kind: MyRequestKind,
  assetId: string | null,
  _prevState: MyRequestState,
  formData: FormData
): Promise<MyRequestState> {
  const session = await requireSession();
  if (!canSubmitGaRequest(session) || !session.user.employeeId) return { error: t("common.forbidden") };
  const employeeId = session.user.employeeId;
  const requestType = TYPE_BY_KIND[kind];

  const urgencyRaw = (formData.get("urgency") as string) || "MEDIUM";
  if (!["LOW", "MEDIUM", "HIGH"].includes(urgencyRaw)) return { error: "Urgensi tidak valid." };

  let description = ((formData.get("description") as string) ?? "").trim();
  const textError = validateRequestText(requestType, description);
  if (textError) return { error: textError };

  let locationId: string | null = null;
  if (kind !== "NEED") {
    if (!assetId) return { error: "Aset wajib dipilih." };
    const custody = await prisma.assetCustody.findFirst({ where: { assetId, employeeId, status: "ACTIVE" }, select: { locationId: true } });
    if (!custody) return { error: "Aset ini tidak sedang Anda pegang." };
    locationId = custody.locationId;

    const open = await prisma.gaRequest.findFirst({
      where: { assetId, requestType, status: { in: OPEN_REPORT_STATUSES[requestType as "DAMAGE_OR_ABNORMAL_CONDITION" | "LOSS"] } },
      select: { requestNumber: true },
    });
    if (open) return { error: `Aset ini sudah dilaporkan (${open.requestNumber}).` };

    if (kind === "LOSS") {
      const lostOn = formatLossDate((formData.get("lostOn") as string) ?? "");
      if (lostOn) description = `Perkiraan tanggal hilang: ${lostOn}\n${description}`;
    }
  }

  let evidenceFileId: string | undefined;
  const evidenceFile = kind === "NEED" ? null : (formData.get("evidenceFile") as File | null);
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return { error: validationError };
    const storageKey = randomStorageKey("ga-request", getExtension(evidenceFile.name));
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        sensitivity: "RESTRICTED",
        employeeId,
        uploadedByAccountId: session.user.id,
        category: "GA_REQUEST_EVIDENCE",
        confidential: false,
      },
    });
    evidenceFileId = fileObject.id;
  }

  const year = companyYear();
  const requestNumber = formatGaRequestNumber(await nextSequence(`GAR-${year}`), year);

  const created = await prisma.gaRequest.create({
    data: {
      requestNumber,
      requestType,
      urgency: urgencyRaw as GaRequestUrgency,
      description,
      requesterEmployeeId: employeeId,
      submittedByAccountId: session.user.id,
      assetId: kind === "NEED" ? null : assetId,
      locationId,
      evidenceFileId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "GaRequest",
    recordId: created.id,
    reason: `Submitted ${requestType} request ${requestNumber}`,
  });

  revalidatePath("/my-assets");
  revalidatePath("/ga-requests");
  const what = kind === "NEED" ? "Permintaan aset" : kind === "DAMAGE" ? "Laporan kerusakan" : "Laporan kehilangan";
  return { done: `${what} terkirim (${requestNumber}).` };
}
