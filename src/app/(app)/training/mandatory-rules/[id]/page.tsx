import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageMandatoryTrainingRule } from "@/lib/permissions";
import { resolveMandatoryTrainingAudience } from "@/lib/mandatory-training";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ApplyRuleButton } from "../apply-rule-button";

const TARGET_LABEL: Record<string, string> = {
  EMPLOYEE: "Karyawan",
  DEPARTMENT: "Departemen",
  JOB: "Jabatan Standar",
  PRIMARY_POSITION: "Posisi Utama",
  EVERYONE: "Semua Karyawan",
};

// PDF workflow "B. ASSIGNMENT" mandatory path: Training Admin selects a
// Mandatory rule and target group, previews the resolved audience, then
// confirms — the actual assignment creation stays in
// applyMandatoryTrainingRuleAction, unchanged, called from the confirm
// button on this page.
export default async function MandatoryTrainingRulePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageMandatoryTrainingRule(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const rule = await prisma.mandatoryTrainingRule.findUnique({
    where: { id },
    include: {
      course: { select: { title: true } },
      targetEmployee: { select: { fullLegalName: true, employeeNumber: true } },
      targetDepartment: { select: { unitName: true } },
      targetJob: { select: { jobTitle: true } },
      targetPosition: { select: { positionCode: true, job: { select: { jobTitle: true } } } },
    },
  });
  if (!rule) notFound();

  const audienceIds = await resolveMandatoryTrainingAudience(rule);

  const [employees, existingAssignments] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: audienceIds } },
      orderBy: { fullLegalName: "asc" },
      select: {
        id: true,
        employeeNumber: true,
        fullLegalName: true,
        currentPosition: { select: { job: { select: { jobTitle: true } }, orgUnit: { select: { unitName: true } } } },
      },
    }),
    prisma.learningAssignment.findMany({
      where: { courseId: rule.courseId, employeeId: { in: audienceIds }, status: { not: "CANCELLED" } },
      select: { employeeId: true },
    }),
  ]);
  const alreadyAssignedIds = new Set(existingAssignments.map((e) => e.employeeId));
  const newlyAssignedCount = audienceIds.length - alreadyAssignedIds.size;

  return (
    <div>
      <Link href="/training/mandatory-rules" className="text-xs text-indigo-600 hover:underline">
        ← Kembali ke Aturan Pelatihan Wajib
      </Link>
      <h1 className="mt-2 text-lg font-medium text-slate-900">Pratinjau Audiens</h1>
      <p className="mt-1 text-sm text-slate-500">
        {rule.course.title} · Target: {TARGET_LABEL[rule.targetType]}
        {rule.targetEmployee ? ` — ${rule.targetEmployee.employeeNumber} ${rule.targetEmployee.fullLegalName}` : ""}
        {rule.targetDepartment ? ` — ${rule.targetDepartment.unitName}` : ""}
        {rule.targetJob ? ` — ${rule.targetJob.jobTitle}` : ""}
        {rule.targetPosition ? ` — ${rule.targetPosition.positionCode} (${rule.targetPosition.job.jobTitle})` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Audiens dihitung langsung dari data organisasi dan Penempatan Utama saat ini. Karyawan yang sudah memiliki
        penugasan aktif untuk pelatihan ini tidak akan ditugaskan ulang.
      </p>

      <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
        Total audiens: <strong>{audienceIds.length}</strong> karyawan · Akan ditugaskan baru:{" "}
        <strong>{newlyAssignedCount}</strong> · Sudah memiliki penugasan aktif: <strong>{alreadyAssignedIds.size}</strong>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">NIK</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Jabatan</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  Tidak ada karyawan pada target ini.
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-xs text-slate-600">{e.employeeNumber}</td>
                <td className="px-4 py-3 text-slate-900">{e.fullLegalName}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{e.currentPosition?.job.jobTitle ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{e.currentPosition?.orgUnit.unitName ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {alreadyAssignedIds.has(e.id) ? (
                    <span className="text-slate-400">Sudah ditugaskan</span>
                  ) : (
                    <span className="font-medium text-emerald-700">Baru</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rule.activeFlag && (
        <div className="mt-4">
          <ApplyRuleButton
            ruleId={rule.id}
            label={`Konfirmasi Penerapan (${newlyAssignedCount} baru)`}
            alreadyAssignedCount={alreadyAssignedIds.size}
          />
        </div>
      )}
    </div>
  );
}
