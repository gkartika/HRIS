import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, isTrainingAdmin, isGaAdmin, canListEmployees } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-medium text-slate-900">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const roleLabels = session.user.roles.map((r) => t(`roles.${r}`)).join(", ");

  const cards: { label: string; value: string | number }[] = [];

  if (canListEmployees(session)) {
    const employeeCount = await prisma.employee.count({ where: { activeFlag: true } });
    cards.push({ label: "Total Karyawan Aktif", value: employeeCount });
  }
  if (isHrAdmin(session)) {
    const [vacantPositions, importBatches, auditEvents] = await Promise.all([
      prisma.position.count({ where: { positionStatus: "VACANT" } }),
      prisma.importBatch.count(),
      prisma.auditLog.count(),
    ]);
    cards.push({ label: "Posisi Kosong", value: vacantPositions });
    cards.push({ label: "Riwayat Impor", value: importBatches });
    cards.push({ label: "Total Peristiwa Audit", value: auditEvents });
  }
  if (isTrainingAdmin(session) || isGaAdmin(session)) {
    const positions = await prisma.position.count({ where: { positionStatus: "FILLED" } });
    cards.push({ label: "Posisi Terisi", value: positions });
  }
  if (isGaAdmin(session)) {
    const [totalAssets, inUseAssets, activeCustodies, underRepair] = await Promise.all([
      prisma.fixedAsset.count({ where: { activeFlag: true } }),
      prisma.fixedAsset.count({ where: { activeFlag: true, status: "IN_USE" } }),
      prisma.assetCustody.count({ where: { status: "ACTIVE" } }),
      prisma.fixedAsset.count({ where: { activeFlag: true, status: "UNDER_REPAIR" } }),
    ]);
    cards.push({ label: "Total Aset Aktif", value: totalAssets });
    cards.push({ label: "Sedang Digunakan", value: inUseAssets });
    cards.push({ label: "Total Penguasaan Aktif", value: activeCustodies });
    cards.push({ label: "Dalam Perbaikan", value: underRepair });

    const [openGaRequests, openWorkOrders, openDisposalCases] = await Promise.all([
      prisma.gaRequest.count({
        where: { status: { in: ["SUBMITTED", "PENDING_APPROVAL", "PENDING_LOSS_REVIEW"] } },
      }),
      prisma.maintenanceWorkOrder.count({ where: { status: "OPEN" } }),
      prisma.disposalCase.count({ where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } } }),
    ]);
    cards.push({ label: "Permintaan GA Terbuka", value: openGaRequests });
    cards.push({ label: "Work Order Terbuka", value: openWorkOrders });
    cards.push({ label: "Kasus Disposal Aktif", value: openDisposalCases });
  }
  if (session.user.employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      include: { currentPosition: { include: { job: true, orgUnit: true } } },
    });
    if (employee?.currentPosition) {
      cards.push({ label: "Jabatan Saat Ini", value: employee.currentPosition.job.jobTitle });
      cards.push({ label: "Unit Organisasi", value: employee.currentPosition.orgUnit.unitName });
    }
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">
        {t("nav.dashboard")} — {session.user.name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">Peran: {roleLabels}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} />
        ))}
        {cards.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">Tidak ada data ringkasan untuk peran ini.</p>
        )}
      </div>
    </div>
  );
}
