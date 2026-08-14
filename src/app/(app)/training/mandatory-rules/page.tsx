import { requireSession } from "@/lib/require-session";
import { canManageMandatoryTrainingRule } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import Link from "next/link";
import { CreateRuleForm } from "./create-rule-form";
import { DeactivateRuleButton } from "./deactivate-rule-button";

const TARGET_LABEL: Record<string, string> = {
  EMPLOYEE: "Karyawan",
  DEPARTMENT: "Departemen",
  JOB: "Jabatan Standar",
  PRIMARY_POSITION: "Posisi Utama",
  EVERYONE: "Semua Karyawan",
};

export default async function MandatoryTrainingRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string; status?: string; courseId?: string }>;
}) {
  const session = await requireSession();
  if (!canManageMandatoryTrainingRule(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }
  const { applied, status, courseId } = await searchParams;

  const [rules, courses, employees, departments, jobs, positions] = await Promise.all([
    prisma.mandatoryTrainingRule.findMany({
      where: {
        ...(status ? { activeFlag: status === "active" } : {}),
        ...(courseId ? { courseId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { title: true } },
        targetEmployee: { select: { fullLegalName: true, employeeNumber: true } },
        targetDepartment: { select: { unitName: true } },
        targetJob: { select: { jobTitle: true } },
        targetPosition: { select: { positionCode: true, job: { select: { jobTitle: true } } } },
        _count: { select: { learningAssignments: true } },
      },
    }),
    prisma.trainingCourse.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.employee.findMany({ where: { activeFlag: true }, orderBy: { fullLegalName: "asc" }, select: { id: true, employeeNumber: true, fullLegalName: true } }),
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" }, select: { id: true, unitName: true } }),
    prisma.job.findMany({ orderBy: { jobTitle: "asc" }, select: { id: true, jobTitle: true } }),
    prisma.position.findMany({ orderBy: { positionCode: "asc" }, select: { id: true, positionCode: true, job: { select: { jobTitle: true } } } }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Aturan Pelatihan Wajib (Mandatory Training)</h1>
      <p className="mt-1 text-sm text-slate-500">
        Audiens dihitung langsung dari data organisasi dan Penempatan Utama saat ini — &ldquo;Terapkan&rdquo; tidak pernah mendaftarkan
        karyawan yang sudah memiliki penugasan aktif untuk pelatihan yang sama.
      </p>

      {applied !== undefined && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Diterapkan — {applied} karyawan baru ditugaskan.
        </p>
      )}

      <div className="mt-4">
        <CreateRuleForm courses={courses} employees={employees} departments={departments} jobs={jobs} positions={positions} />
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Pelatihan</label>
          <select name="courseId" defaultValue={courseId ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("common.applyFilter")}
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Pelatihan</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Rincian</th>
              <th className="px-4 py-3 font-medium">Ditugaskan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                  Belum ada aturan.
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{r.course.title}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{TARGET_LABEL[r.targetType]}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {r.targetEmployee ? `${r.targetEmployee.employeeNumber} — ${r.targetEmployee.fullLegalName}` : ""}
                  {r.targetDepartment?.unitName ?? ""}
                  {r.targetJob?.jobTitle ?? ""}
                  {r.targetPosition ? `${r.targetPosition.positionCode} — ${r.targetPosition.job.jobTitle}` : ""}
                  {r.targetType === "EVERYONE" ? "—" : ""}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{r._count.learningAssignments}</td>
                <td className="px-4 py-3 text-xs">{r.activeFlag ? "Aktif" : "Nonaktif"}</td>
                <td className="px-4 py-3 text-right">
                  {r.activeFlag && (
                    <div className="flex justify-end gap-3">
                      <Link href={`/training/mandatory-rules/${r.id}`} className="text-xs text-indigo-600 hover:underline">
                        Pratinjau &amp; Terapkan
                      </Link>
                      <DeactivateRuleButton ruleId={r.id} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
