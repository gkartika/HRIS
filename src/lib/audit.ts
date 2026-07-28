import { prisma } from "@/lib/db";
import type { AuditAction } from "@/generated/prisma/enums";

interface LogAuditInput {
  actorAccountId: string | null;
  action: AuditAction;
  datasetName: string;
  recordId?: string | null;
  fieldName?: string | null;
  oldValueMasked?: string | null;
  newValueMasked?: string | null;
  reason?: string | null;
}

// Append-only audit trail (CTL-01, CTL-02). Every sensitive view, mutation, import,
// and auth event should call this. Never update or delete an AuditLog row from
// application code.
export async function logAudit(input: LogAuditInput) {
  await prisma.auditLog.create({
    data: {
      actorAccountId: input.actorAccountId,
      action: input.action,
      datasetName: input.datasetName,
      recordId: input.recordId ?? null,
      fieldName: input.fieldName ?? null,
      oldValueMasked: input.oldValueMasked ?? null,
      newValueMasked: input.newValueMasked ?? null,
      reason: input.reason ?? null,
    },
  });
}
