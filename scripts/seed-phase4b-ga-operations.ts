// One-time UAT seed for Phase 4B — GA Operations. Configures Position-based
// approvals and leaves four clean open scenarios for live demo, matching
// the acceptance checklist: (1) NEW_ASSET_NEED approve+Phase 4A handoff,
// (2) NEW_ASSET_NEED reject, (3) DAMAGE_OR_ABNORMAL_CONDITION corrective
// repair, (4) LOSS confirm -> disposal. Preventive maintenance and
// beyond-repair disposal are seeded as ready-to-execute work orders so
// those two checkpoints don't require a second submit/verify round trip.
import { prisma } from "../src/lib/db";
import { formatWorkOrderNumber } from "../src/lib/ga-operations";

async function main() {
  const gaAdmin = await prisma.account.findFirstOrThrow({ where: { roles: { some: { role: "GA_ADMIN" } } } });

  const ahmadi = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: "EMP-0011" }, include: { account: true } });
  const suhartono = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: "EMP-0107" }, include: { account: true } });
  // RISWANTO (level3.production@cbp.demo) holds "Asst Manager Production" —
  // reused as the configured approver Position for all three GA approval
  // types; a real, already-login-capable Position rather than inventing a
  // new one, same "config points to a Position, not a person" convention
  // used everywhere else in this app.
  const riswanto = await prisma.employee.findFirstOrThrow({
    where: { employeeNumber: "EMP-0092" },
    include: { currentPosition: true },
  });
  if (!riswanto.currentPositionId) throw new Error("RISWANTO (EMP-0092) has no current Position — cannot configure GA approvals.");

  for (const approvalType of ["NEW_ASSET_NEED", "LOSS_REVIEW", "DISPOSAL"] as const) {
    await prisma.gaApprovalConfig.upsert({
      where: { approvalType },
      update: { approverPositionId: riswanto.currentPositionId, updatedByAccountId: gaAdmin.id },
      create: { approvalType, approverPositionId: riswanto.currentPositionId, updatedByAccountId: gaAdmin.id },
    });
  }

  const laptop002 = await prisma.fixedAsset.findFirstOrThrow({ where: { assetCode: "AST-LAPTOP-002" } });
  const deskStanding = await prisma.fixedAsset.findFirstOrThrow({ where: { assetCode: "AST-DESK-001" } });

  // New asset for the LOSS checkpoint — currently in SUHARTONO's custody.
  const tool = await prisma.fixedAsset.upsert({
    where: { assetCode: "AST-TOOL-001" },
    update: {},
    create: {
      assetCode: "AST-TOOL-001",
      assetName: "Bor Tangan Cordless Makita",
      category: "Tools & Equipment",
      trackingType: "INDIVIDUAL",
      status: "IN_USE",
      purchaseDate: new Date("2025-04-12"),
      purchaseCost: 1850000,
      createdByAccountId: gaAdmin.id,
    },
  });
  const existingToolCustody = await prisma.assetCustody.findFirst({ where: { assetId: tool.id } });
  if (!existingToolCustody) {
    await prisma.assetCustody.create({
      data: {
        assetId: tool.id,
        targetType: "EMPLOYEE",
        employeeId: suhartono.id,
        status: "ACTIVE",
        conditionAtHandover: "Baik",
        assignedByAccountId: gaAdmin.id,
      },
    });
  }

  // New asset for the BEYOND_REPAIR disposal checkpoint — already
  // UNDER_REPAIR with an OPEN preventive work order ready to execute live.
  const copier = await prisma.fixedAsset.upsert({
    where: { assetCode: "AST-MACHINE-001" },
    update: {},
    create: {
      assetCode: "AST-MACHINE-001",
      assetName: "Mesin Fotokopi Kantor",
      category: "Office Equipment",
      trackingType: "INDIVIDUAL",
      status: "UNDER_REPAIR",
      purchaseDate: new Date("2022-05-10"),
      purchaseCost: 22000000,
      createdByAccountId: gaAdmin.id,
      notes: "Sering macet dan hasil cetak buram — kemungkinan sudah tidak ekonomis diperbaiki.",
    },
  });
  const existingCopierWorkOrder = await prisma.maintenanceWorkOrder.findFirst({ where: { assetId: copier.id, status: "OPEN" } });
  if (!existingCopierWorkOrder) {
    const year = new Date().getFullYear();
    const countThisYear = await prisma.maintenanceWorkOrder.count({ where: { workOrderNumber: { startsWith: `WO-${year}-` } } });
    await prisma.maintenanceWorkOrder.create({
      data: {
        workOrderNumber: formatWorkOrderNumber(countThisYear + 1, year),
        assetId: copier.id,
        sourceType: "PREVENTIVE",
        workType: "VENDOR",
        checklistNotes: "Servis rutin — periksa unit fuser dan drum, evaluasi kelayakan perbaikan.",
        createdByAccountId: gaAdmin.id,
      },
    });
  }

  // Preventive maintenance plan, already due — for the "create work order
  // from plan" + "execute, OPERATIONAL outcome" checkpoint.
  const existingDeskPlan = await prisma.maintenancePlan.findFirst({ where: { assetId: deskStanding.id, activeFlag: true } });
  if (!existingDeskPlan) {
    await prisma.maintenancePlan.create({
      data: {
        assetId: deskStanding.id,
        description: "Servis rutin motor elevasi standing desk",
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        intervalDays: 180,
        createdByAccountId: gaAdmin.id,
      },
    });
  }

  // Four open GA requests, one per demo checkpoint. All left at SUBMITTED
  // so GA Admin verifies/routes them live rather than pre-resolved.
  async function ensureRequest(params: {
    code: string;
    requestType: "NEW_ASSET_NEED" | "DAMAGE_OR_ABNORMAL_CONDITION" | "LOSS";
    requesterEmployeeId: string;
    submittedByAccountId: string;
    description: string;
    assetId?: string;
    urgency?: "LOW" | "MEDIUM" | "HIGH";
  }) {
    const existing = await prisma.gaRequest.findUnique({ where: { requestNumber: params.code } });
    if (existing) return;
    await prisma.gaRequest.create({
      data: {
        requestNumber: params.code,
        requestType: params.requestType,
        urgency: params.urgency ?? "MEDIUM",
        description: params.description,
        requesterEmployeeId: params.requesterEmployeeId,
        submittedByAccountId: params.submittedByAccountId,
        assetId: params.assetId ?? null,
      },
    });
  }

  await ensureRequest({
    code: "GAR-DEMO-0001",
    requestType: "NEW_ASSET_NEED",
    requesterEmployeeId: ahmadi.id,
    submittedByAccountId: ahmadi.account!.id,
    description: "Perlu laptop cadangan untuk anggota tim baru di divisi produksi.",
  });
  await ensureRequest({
    code: "GAR-DEMO-0002",
    requestType: "NEW_ASSET_NEED",
    requesterEmployeeId: suhartono.id,
    submittedByAccountId: suhartono.account!.id,
    description: "Permintaan meja tambahan — belum ada anggaran disetujui untuk kuartal ini.",
  });
  await ensureRequest({
    code: "GAR-DEMO-0003",
    requestType: "DAMAGE_OR_ABNORMAL_CONDITION",
    requesterEmployeeId: ahmadi.id,
    submittedByAccountId: ahmadi.account!.id,
    description: "Layar laptop bergaris dan perangkat sering restart sendiri.",
    assetId: laptop002.id,
    urgency: "HIGH",
  });
  await ensureRequest({
    code: "GAR-DEMO-0004",
    requestType: "LOSS",
    requesterEmployeeId: suhartono.id,
    submittedByAccountId: suhartono.account!.id,
    description: "Bor tangan tidak ditemukan sejak inventarisasi gudang minggu lalu.",
    assetId: tool.id,
  });

  console.log("Phase 4B UAT GA Operations data seeded.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
