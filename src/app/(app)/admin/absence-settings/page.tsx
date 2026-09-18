import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { TypeQuotaRowForm } from "./type-quota-row-form";
import { NewTypeForm } from "./new-type-form";
import { ApproverRowForm } from "./approver-row-form";
import { QuotaOverrideRowForm } from "./quota-override-row-form";
import { AddQuotaOverrideForm } from "./add-quota-override-form";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

export default async function AbsenceSettingsPage() {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [types, entitlements, departments, positions, approverConfigs, overrides, employees] = await Promise.all([
    prisma.absenceTypeConfig.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.absenceEntitlementConfig.findMany(),
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
    prisma.position.findMany({ include: { job: true, orgUnit: true }, orderBy: { positionCode: "asc" } }),
    prisma.absenceApproverConfig.findMany(),
    prisma.absenceQuotaOverride.findMany({
      include: {
        employee: { select: { employeeNumber: true, fullLegalName: true } },
        absenceType: { select: { label: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.employee.findMany({
      where: { activeFlag: true },
      orderBy: { fullLegalName: "asc" },
      select: { id: true, employeeNumber: true, fullLegalName: true },
    }),
  ]);

  const annualDaysByType = new Map(entitlements.map((e) => [e.absenceTypeCode, e.annualDays]));
  const typeQuotaRows = types.map((tp) => ({
    code: tp.code,
    label: tp.label,
    requiresFirstApproval: tp.requiresFirstApproval,
    activeFlag: tp.activeFlag,
    annualDays: annualDaysByType.get(tp.code) ?? null,
  }));

  const configByDepartmentId = new Map(approverConfigs.map((c) => [c.departmentId, c.approverPositionId]));
  const positionOptions = positions.map((p) => ({
    id: p.id,
    label: `${p.jobLevel} ${p.job.jobTitle} — ${p.orgUnit.unitName}`,
  }));

  const overrideRows = overrides.map((o) => ({
    employeeId: o.employeeId,
    employeeLabel: `${o.employee.employeeNumber} — ${o.employee.fullLegalName}`,
    absenceTypeCode: o.absenceTypeCode,
    absenceTypeLabel: o.absenceType.label,
    annualDays: o.annualDays,
    updatedAt: formatDate(o.updatedAt),
  }));
  const employeeOptions = employees.map((e) => ({ id: e.id, label: `${e.employeeNumber} — ${e.fullLegalName}` }));
  const activeTypeOptions = types.filter((tp) => tp.activeFlag).map((tp) => ({ code: tp.code, label: tp.label }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-slate-900">Pengaturan Absensi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Jenis Absensi, alur persetujuan, jatah tahunan, penyetuju per Departemen, dan pengecualian jatah per
          karyawan — semua dalam satu halaman.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-slate-900">Jenis Absensi, Alur Persetujuan & Jatah Default</h2>
        <p className="mt-1 text-xs text-slate-500">
          "Perlu Penyetuju Pertama" menentukan apakah jenis ini melalui tahap Penyetuju Pertama sebelum HR Admin
          (mis. Sakit biasanya tidak). Persetujuan HR Admin selalu menjadi tahap akhir wajib. Jatah Tahunan Default:
          kosongkan untuk tidak dibatasi (dievaluasi kasus per kasus), isi 0 jika jenis ini tidak diberikan secara
          default (mis. Cuti — lalu atur jatah per orang lewat Override Jatah per Karyawan di bawah).
        </p>
        <div className="mt-3 space-y-3">
          {typeQuotaRows.map((row) => (
            <TypeQuotaRowForm key={row.code} row={row} />
          ))}
          {typeQuotaRows.length === 0 && <p className="text-sm text-slate-400">Belum ada jenis Absensi.</p>}
        </div>
        <div className="mt-3">
          <NewTypeForm />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-900">Penyetuju Pertama per Departemen</h2>
        <p className="mt-1 text-xs text-slate-500">
          Setiap Departemen memiliki satu Posisi yang menjadi penyetuju tahap pertama, untuk jenis Absensi yang
          memerlukannya.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Departemen</th>
                <th className="px-4 py-3 font-medium">Penyetuju Pertama</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{d.unitName}</td>
                  <td className="px-4 py-3">
                    <ApproverRowForm
                      departmentId={d.id}
                      positions={positionOptions}
                      currentApproverPositionId={configByDepartmentId.get(d.id) ?? null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {departments.length === 0 && <p className="p-4 text-sm text-slate-400">Belum ada Departemen.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-900">Override Jatah per Karyawan</h2>
        <p className="mt-1 text-xs text-slate-500">
          Pengecualian jatah tahunan untuk karyawan tertentu, di luar jatah default perusahaan di atas. Kosongkan
          jumlah hari pada baris yang sudah ada untuk menghapus override tersebut.
        </p>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          {overrideRows.map((row) => (
            <QuotaOverrideRowForm key={`${row.employeeId}:${row.absenceTypeCode}`} row={row} />
          ))}
          {overrideRows.length === 0 && <p className="text-sm text-slate-400">Belum ada override jatah.</p>}
        </div>
        <div className="mt-3">
          <AddQuotaOverrideForm employees={employeeOptions} absenceTypes={activeTypeOptions} />
        </div>
      </section>
    </div>
  );
}
