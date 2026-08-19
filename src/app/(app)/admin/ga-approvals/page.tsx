import { requireSession } from "@/lib/require-session";
import { canManageGaApprovalConfig } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ApprovalRowForm } from "./approval-row-form";
import type { GaApprovalType } from "@/generated/prisma/enums";

const APPROVAL_TYPES: { type: GaApprovalType; label: string; desc: string }[] = [
  {
    type: "NEW_ASSET_NEED",
    label: "Kebutuhan Aset Baru",
    desc: "Jika tidak diatur, permintaan kebutuhan aset baru diproses langsung tanpa persetujuan.",
  },
  {
    type: "LOSS_REVIEW",
    label: "Peninjauan Kehilangan",
    desc: "Posisi yang meninjau dan mengonfirmasi laporan kehilangan aset.",
  },
  {
    type: "DISPOSAL",
    label: "Persetujuan Akhir Disposal",
    desc: "Posisi yang memberikan persetujuan akhir sebelum aset dihapuskan/dijual.",
  },
];

export default async function GaApprovalsPage() {
  const session = await requireSession();
  if (!canManageGaApprovalConfig(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [positions, configs] = await Promise.all([
    prisma.position.findMany({ include: { job: true, orgUnit: true }, orderBy: { positionCode: "asc" } }),
    prisma.gaApprovalConfig.findMany(),
  ]);

  const configByType = new Map(configs.map((c) => [c.approvalType, c.approverPositionId]));
  const positionOptions = positions.map((p) => ({
    id: p.id,
    label: `${p.jobLevel} ${p.job.jobTitle} — ${p.orgUnit.unitName}`,
  }));

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Konfigurasi Persetujuan GA Operations</h1>
      <p className="mt-1 text-sm text-slate-500">
        Atur Posisi mana yang menjadi penyetuju untuk setiap tahap persetujuan GA Operations. Persetujuan tidak
        pernah ditetapkan ke karyawan tertentu — selalu ke Posisi, dan berlaku untuk siapa pun yang saat ini
        menjabat Posisi tersebut.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tahap Persetujuan</th>
              <th className="px-4 py-3 font-medium">Posisi Penyetuju</th>
            </tr>
          </thead>
          <tbody>
            {APPROVAL_TYPES.map((a) => (
              <tr key={a.type} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{a.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{a.desc}</p>
                </td>
                <td className="px-4 py-3">
                  <ApprovalRowForm
                    approvalType={a.type}
                    positions={positionOptions}
                    currentApproverPositionId={configByType.get(a.type) ?? null}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
