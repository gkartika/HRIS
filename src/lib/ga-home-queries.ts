// Everything the Admin GA Beranda needs: one count/oldest summary per area
// (the "status tiles") and one combined list of what is waiting for GA (the
// "Perlu ditindak" list). Reads only; GA Admin gates the caller.
import { prisma } from "@/lib/db";
import { listItemsWithStock } from "@/lib/consumables-queries";
import {
  countBy,
  daysSince,
  daysUntil,
  deadlineLabel,
  deadlineSeverity,
  oldestAge,
  sortTodo,
  waitingLabel,
  waitingSeverity,
  type Severity,
  type TodoKind,
  type TodoRow,
} from "@/lib/ga-home";

export interface TilePart {
  label: string;
  count: number;
  hint?: string;
}

export interface GaTile {
  // Which list filter the tile switches on; null = none (it only links out).
  filter: TodoKind | null;
  title: string;
  total: number;
  parts: TilePart[];
  note: string | null;
  severity: Severity;
  openHref: string;
}

export interface LowStockItem {
  id: string;
  itemCode: string;
  itemName: string;
  stock: number;
  minStock: number;
  status: "MENIPIS" | "HABIS";
}

export interface GaHomeData {
  tiles: GaTile[];
  todo: TodoRow[];
  todoCounts: Record<TodoKind | "all", number>;
  assetSummary: { totalAssets: number; inUse: number; activeCustodies: number };
  lowStock: LowStockItem[];
}

const GA_REQUEST_TYPE: Record<string, string> = {
  NEW_ASSET_NEED: "Kebutuhan Aset Baru",
  DAMAGE_OR_ABNORMAL_CONDITION: "Kerusakan",
  LOSS: "Kehilangan",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });

export async function getGaHomeData(now: Date = new Date()): Promise<GaHomeData> {
  const [requests, workOrders, disposals, offboardingCases, assetCounts, items] = await Promise.all([
    prisma.gaRequest.findMany({
      where: { status: { in: ["SUBMITTED", "PENDING_APPROVAL", "APPROVED", "PENDING_LOSS_REVIEW"] } },
      select: {
        id: true,
        requestNumber: true,
        requestType: true,
        status: true,
        submittedAt: true,
        requester: { select: { fullLegalName: true } },
        asset: { select: { assetName: true, assetCode: true } },
      },
    }),
    prisma.maintenanceWorkOrder.findMany({
      where: { status: "OPEN" },
      select: { id: true, workOrderNumber: true, sourceType: true, createdAt: true, asset: { select: { assetName: true, assetCode: true } } },
    }),
    prisma.disposalCase.findMany({
      where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        createdAt: true,
        decisionAt: true,
        asset: { select: { assetName: true, assetCode: true } },
      },
    }),
    // Cases GA has not signed off yet — the same list as Klirens Aset Offboarding.
    prisma.offboardingCase.findMany({
      where: { status: "PENDING_CLEARANCE", gaAssetClearanceConfirmedAt: null },
      select: {
        id: true,
        caseNumber: true,
        clearanceDueDate: true,
        employeeId: true,
        employee: { select: { fullLegalName: true, employeeNumber: true } },
      },
      orderBy: { clearanceDueDate: "asc" },
    }),
    Promise.all([
      prisma.fixedAsset.count({ where: { activeFlag: true } }),
      prisma.fixedAsset.count({ where: { activeFlag: true, status: "IN_USE" } }),
      prisma.assetCustody.count({ where: { status: "ACTIVE" } }),
      prisma.fixedAsset.count({ where: { activeFlag: true, status: "UNDER_REPAIR" } }),
      prisma.fixedAsset.count({ where: { activeFlag: true, status: "LOST_PENDING_REVIEW" } }),
    ]),
    listItemsWithStock(),
  ]);
  const [totalAssets, inUse, activeCustodies, underRepair, lostPending] = assetCounts;

  const caseEmployeeIds = offboardingCases.map((c) => c.employeeId);
  const openCustodyGroups = caseEmployeeIds.length
    ? await prisma.assetCustody.groupBy({
        by: ["employeeId"],
        where: { employeeId: { in: caseEmployeeIds }, status: { not: "RETURNED" } },
        _count: { _all: true },
      })
    : [];
  const openCustodyByEmployee = new Map(openCustodyGroups.map((g) => [g.employeeId, g._count._all]));

  const todo: TodoRow[] = [];

  // ---- Permintaan GA ----
  const requestStatus = countBy(requests, (r) => r.status);
  for (const r of requests.filter((x) => x.status === "SUBMITTED" || x.status === "APPROVED")) {
    const age = daysSince(r.submittedAt, now);
    const verifying = r.status === "SUBMITTED";
    todo.push({
      kind: "ga",
      type: `Permintaan GA · ${GA_REQUEST_TYPE[r.requestType] ?? r.requestType}`,
      title: r.asset ? `${r.asset.assetName} (${r.asset.assetCode})` : r.requestNumber,
      who: `${r.requester.fullLegalName} · ${r.requestNumber}`,
      statusLabel: verifying ? "Diajukan" : "Disetujui, belum diproses",
      severity: waitingSeverity(age),
      urgency: age,
      timeLabel: waitingLabel(age),
      actionLabel: verifying ? "Verifikasi" : "Proses",
      href: `/ga-requests/${r.id}`,
    });
  }

  // ---- Work Order ----
  for (const w of workOrders) {
    const age = daysSince(w.createdAt, now);
    todo.push({
      kind: "wo",
      type: `Work Order · ${w.sourceType === "PREVENTIVE" ? "Preventif" : "Korektif"}`,
      title: `${w.asset.assetName} (${w.asset.assetCode})`,
      who: w.workOrderNumber,
      statusLabel: "Terbuka",
      severity: waitingSeverity(age),
      urgency: age,
      timeLabel: waitingLabel(age),
      actionLabel: "Buka",
      href: `/maintenance/work-orders/${w.id}`,
    });
  }

  // ---- Disposal (Draf needs submitting, Disetujui needs carrying out;
  // Menunggu Persetujuan is already in "Perlu Persetujuan") ----
  for (const c of disposals.filter((x) => x.status === "DRAFT" || x.status === "APPROVED")) {
    const since = c.status === "APPROVED" ? (c.decisionAt ?? c.createdAt) : c.createdAt;
    const age = daysSince(since, now);
    todo.push({
      kind: "dp",
      type: "Kasus Disposal",
      title: `${c.asset.assetName} (${c.asset.assetCode})`,
      who: c.caseNumber,
      statusLabel: c.status === "APPROVED" ? "Disetujui, belum dilaksanakan" : "Draf",
      severity: waitingSeverity(age),
      urgency: age,
      timeLabel: waitingLabel(age),
      actionLabel: c.status === "APPROVED" ? "Laksanakan" : "Ajukan",
      href: `/disposal-cases/${c.id}`,
    });
  }

  // ---- Klirens aset offboarding ----
  for (const c of offboardingCases) {
    const left = daysUntil(c.clearanceDueDate, now);
    const open = openCustodyByEmployee.get(c.employeeId) ?? 0;
    todo.push({
      kind: "of",
      type: "Offboarding · Klirens aset",
      title: `${c.employee.fullLegalName} (${c.employee.employeeNumber})`,
      who: open > 0 ? `${open} aset belum dikembalikan` : "tidak ada aset, tinggal konfirmasi",
      statusLabel: `Batas ${dateFmt.format(c.clearanceDueDate)}`,
      severity: deadlineSeverity(left),
      urgency: 100 - left,
      timeLabel: deadlineLabel(left),
      actionLabel: "Buka klirens",
      href: "/offboarding/asset-clearance",
    });
  }

  // ---- Stok ----
  const lowStock: LowStockItem[] = items
    .filter((i) => !i.archived && i.status !== "AMAN")
    .map((i) => ({
      id: i.id,
      itemCode: i.itemCode,
      itemName: i.itemName,
      stock: i.stock,
      minStock: i.minStock,
      status: i.status as "MENIPIS" | "HABIS",
    }))
    .sort((a, b) => a.stock - b.stock);
  for (const i of lowStock) {
    todo.push({
      kind: "st",
      type: "Stok",
      title: `${i.itemName} (${i.itemCode})`,
      who: `stok ${i.stock} dari min ${i.minStock}`,
      statusLabel: i.status === "HABIS" ? "Habis" : "Menipis",
      severity: i.status === "HABIS" ? "rose" : "amber",
      urgency: i.status === "HABIS" ? 5 : 1,
      timeLabel: "",
      actionLabel: "Lihat stok",
      href: `/consumables/stock?status=${i.status}`,
    });
  }

  // ---- Tiles ----
  const requestOldest = oldestAge(requests.map((r) => r.submittedAt), now);
  const woOldest = oldestAge(workOrders.map((w) => w.createdAt), now);
  const woBySource = countBy(workOrders, (w) => w.sourceType);
  const disposalOldest = oldestAge(disposals.map((c) => c.createdAt), now);
  const disposalStatus = countBy(disposals, (c) => c.status);
  const nearest = offboardingCases[0];
  const nearestLeft = nearest ? daysUntil(nearest.clearanceDueDate, now) : null;
  const casesWithAssets = offboardingCases.filter((c) => (openCustodyByEmployee.get(c.employeeId) ?? 0) > 0).length;
  const habis = lowStock.filter((i) => i.status === "HABIS");
  const menipis = lowStock.filter((i) => i.status === "MENIPIS");

  const tiles: GaTile[] = [
    {
      filter: "ga",
      title: "Permintaan GA terbuka",
      total: requests.length,
      parts: [
        { label: "Diajukan", count: requestStatus.SUBMITTED ?? 0, hint: "perlu verifikasi" },
        { label: "Menunggu Persetujuan", count: requestStatus.PENDING_APPROVAL ?? 0 },
        { label: "Menunggu Peninjauan", count: requestStatus.PENDING_LOSS_REVIEW ?? 0 },
        { label: "Disetujui", count: requestStatus.APPROVED ?? 0, hint: "belum diproses" },
      ],
      note: requestOldest === null ? null : `Tertua ${requestOldest} hari`,
      severity: requestOldest === null ? "slate" : waitingSeverity(requestOldest),
      openHref: "/ga-requests",
    },
    {
      filter: "wo",
      title: "Work Order terbuka",
      total: workOrders.length,
      parts: [
        { label: "Korektif", count: woBySource.CORRECTIVE ?? 0 },
        { label: "Preventif", count: woBySource.PREVENTIVE ?? 0 },
      ],
      note: woOldest === null ? null : `Tertua ${woOldest} hari`,
      severity: woOldest === null ? "slate" : waitingSeverity(woOldest),
      openHref: "/maintenance/work-orders",
    },
    {
      filter: "dp",
      title: "Kasus Disposal aktif",
      total: disposals.length,
      parts: [
        { label: "Draf", count: disposalStatus.DRAFT ?? 0 },
        { label: "Menunggu Persetujuan", count: disposalStatus.PENDING_APPROVAL ?? 0 },
        { label: "Disetujui", count: disposalStatus.APPROVED ?? 0, hint: "belum dilaksanakan" },
      ],
      note: disposalOldest === null ? null : `Tertua ${disposalOldest} hari`,
      severity: disposalOldest === null ? "slate" : waitingSeverity(disposalOldest),
      openHref: "/disposal-cases",
    },
    {
      filter: "of",
      title: "Klirens aset offboarding",
      total: offboardingCases.length,
      parts: [
        { label: "Menunggu konfirmasi GA", count: offboardingCases.length },
        { label: "Punya aset belum kembali", count: casesWithAssets },
      ],
      note:
        nearest && nearestLeft !== null
          ? `Batas terdekat ${dateFmt.format(nearest.clearanceDueDate)} (${deadlineLabel(nearestLeft)})`
          : null,
      severity: nearestLeft === null ? "slate" : deadlineSeverity(nearestLeft),
      openHref: "/offboarding/asset-clearance",
    },
    {
      filter: null,
      title: "Aset bermasalah",
      total: underRepair + lostPending,
      parts: [
        { label: "Dalam Perbaikan", count: underRepair },
        { label: "Hilang, menunggu peninjauan", count: lostPending },
      ],
      note: null,
      severity: lostPending > 0 ? "amber" : "slate",
      openHref: "/assets?status=UNDER_REPAIR",
    },
    {
      filter: "st",
      title: "Barang Habis Pakai",
      total: lowStock.length,
      parts: [
        { label: "Menipis", count: menipis.length },
        { label: "Habis", count: habis.length },
      ],
      note: habis.length > 0 ? `${habis[0].itemName} sudah habis` : null,
      severity: habis.length > 0 ? "rose" : menipis.length > 0 ? "amber" : "slate",
      openHref: "/consumables/stock",
    },
  ];

  const sorted = sortTodo(todo);
  const todoCounts = { all: sorted.length, ga: 0, wo: 0, dp: 0, of: 0, st: 0 } as GaHomeData["todoCounts"];
  for (const row of sorted) todoCounts[row.kind] += 1;

  return {
    tiles,
    todo: sorted,
    todoCounts,
    assetSummary: { totalAssets, inUse, activeCustodies },
    lowStock: lowStock.slice(0, 5),
  };
}
