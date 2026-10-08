"use server";

import { t } from "@/lib/i18n/id";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageConsumables } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { evaluateIssueWarnings, isPositiveInteger, issueDelta, parseCompanyDateInput } from "@/lib/consumables";
import { getEmployeeOrgInfo, getLastIssueDates, getMovementTotals, stockFromTotals } from "@/lib/consumables-queries";

export interface EmployeeSearchResult {
  id: string;
  employeeNumber: string;
  fullLegalName: string;
  departmentName: string | null;
  positionTitle: string | null;
}

// Type-ahead for the take screen: active employees only, matched on name or
// employee number. GA Admin only, like every consumables read.
export async function searchConsumableEmployees(query: string): Promise<EmployeeSearchResult[]> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const employees = await prisma.employee.findMany({
    where: {
      activeFlag: true,
      OR: [
        { fullLegalName: { contains: q, mode: "insensitive" } },
        { employeeNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { fullLegalName: "asc" },
    take: 12,
    select: { id: true, employeeNumber: true, fullLegalName: true },
  });
  const org = await getEmployeeOrgInfo(employees.map((e) => e.id));
  return employees.map((e) => ({
    ...e,
    departmentName: org.get(e.id)?.departmentName ?? null,
    positionTitle: org.get(e.id)?.positionTitle ?? null,
  }));
}

// When this employee last took each item that has a replacement period —
// lets the screen show the "sebelum periode" warning instantly while the
// cart changes. The server recomputes everything again on save.
export async function getEmployeeLastIssues(employeeId: string): Promise<Record<string, string>> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return {};
  const items = await prisma.consumableItem.findMany({
    where: { archived: false, replacementPeriodMonths: { gt: 0 } },
    select: { id: true },
  });
  const dates = await getLastIssueDates(prisma, employeeId, items.map((i) => i.id));
  return Object.fromEntries([...dates].map(([itemId, at]) => [itemId, at.toISOString()]));
}

export interface IssueInput {
  recipientType: "EMPLOYEE" | "DEPARTMENT";
  employeeId?: string;
  orgUnitId?: string;
  lines: { itemId: string; quantity: number }[];
  purpose?: string;
  warningReason?: string;
  recordedByLabel?: string;
  occurredAt?: string;
}

export type IssueResult = { error: string } | { success: string; batchId: string };

export async function recordConsumableIssue(input: IssueInput): Promise<IssueResult> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return { error: t("common.forbidden") };

  const purpose = input.purpose?.trim() || null;
  const warningReason = input.warningReason?.trim() || null;
  const recordedByLabel = input.recordedByLabel?.trim() || null;
  const occurredAt = parseCompanyDateInput(input.occurredAt?.trim() ?? "");
  if (occurredAt === "invalid") return { error: "Tanggal tidak valid." };
  if (occurredAt === "future") return { error: "Tanggal tidak boleh di masa depan." };

  // Same item twice in the cart counts as one line.
  const merged = new Map<string, number>();
  for (const line of input.lines ?? []) {
    if (!isPositiveInteger(line.quantity)) return { error: "Jumlah setiap barang harus bilangan bulat lebih dari 0." };
    merged.set(line.itemId, (merged.get(line.itemId) ?? 0) + line.quantity);
  }
  if (merged.size === 0) return { error: "Tambahkan minimal satu barang." };

  // Who took it.
  let recipient: {
    employeeId: string | null;
    orgUnitId: string | null;
    nameSnapshot: string;
    departmentSnapshot: string | null;
  };
  if (input.recipientType === "EMPLOYEE") {
    if (!input.employeeId) return { error: "Pilih karyawan pengambil." };
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, fullLegalName: true, activeFlag: true },
    });
    if (!employee || !employee.activeFlag) return { error: "Karyawan tidak ditemukan atau sudah tidak aktif." };
    const org = await getEmployeeOrgInfo([employee.id]);
    recipient = {
      employeeId: employee.id,
      orgUnitId: null,
      nameSnapshot: employee.fullLegalName,
      departmentSnapshot: org.get(employee.id)?.departmentName ?? null,
    };
  } else if (input.recipientType === "DEPARTMENT") {
    if (!input.orgUnitId) return { error: "Pilih departemen pengambil." };
    const unit = await prisma.orgUnit.findUnique({ where: { id: input.orgUnitId } });
    if (!unit || unit.unitType !== "DEPARTMENT") return { error: "Departemen tidak ditemukan." };
    recipient = { employeeId: null, orgUnitId: unit.id, nameSnapshot: unit.unitName, departmentSnapshot: unit.unitName };
  } else {
    return { error: "Jenis pengambil tidak valid." };
  }

  const batchId = randomUUID();
  const result = await prisma.$transaction(async (db) => {
    const itemIds = [...merged.keys()];
    const items = await db.consumableItem.findMany({ where: { id: { in: itemIds } } });
    if (items.length !== itemIds.length) return { error: "Ada barang yang tidak ditemukan." } as const;
    const archived = items.find((i) => i.archived);
    if (archived) return { error: `Barang ${archived.itemName} sudah diarsipkan.` } as const;

    // A department take is exempt from the replacement-period rule.
    const [lastIssues, totals] = await Promise.all([
      recipient.employeeId ? getLastIssueDates(db, recipient.employeeId, itemIds) : Promise.resolve(new Map<string, Date>()),
      getMovementTotals(db, itemIds),
    ]);

    const evaluated = [];
    for (const item of items) {
      const quantity = merged.get(item.id)!;
      const stock = stockFromTotals(item.openingStock, totals.get(item.id));
      const warnings = evaluateIssueWarnings({
        stock,
        quantity,
        lastIssueAt: lastIssues.get(item.id) ?? null,
        periodMonths: item.replacementPeriodMonths,
        occurredAt,
      });
      evaluated.push({ item, quantity, warnings });
    }

    // Warnings never block, but they must be acknowledged with a reason.
    if (evaluated.some((e) => e.warnings.hasWarning) && !warningReason) {
      return { error: "Ada peringatan stok atau periode ganti. Isi alasan untuk melanjutkan." } as const;
    }

    await db.consumableTransaction.createMany({
      data: evaluated.map((e) => ({
        itemId: e.item.id,
        type: "ISSUE" as const,
        quantityDelta: issueDelta(e.quantity),
        occurredAt,
        recipientType: input.recipientType,
        employeeId: recipient.employeeId,
        orgUnitId: recipient.orgUnitId,
        recipientNameSnapshot: recipient.nameSnapshot,
        departmentNameSnapshot: recipient.departmentSnapshot,
        purpose,
        beforePeriod: e.warnings.beforePeriod,
        exceededStock: e.warnings.exceedsStock,
        warningReason: e.warnings.hasWarning ? warningReason : null,
        batchId,
        recordedByAccountId: session.user.id,
        recordedByLabel,
      })),
    });
    return { count: evaluated.length } as const;
  });

  if (!("count" in result)) return { error: result.error };

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "ConsumableTransaction",
    recordId: batchId,
    reason: `Pengambilan ${result.count} barang oleh ${recipient.nameSnapshot}`,
  });

  revalidatePath("/consumables", "layout");
  return { success: `${result.count} barang dicatat untuk ${recipient.nameSnapshot}.`, batchId };
}
