import { requireSession } from "@/lib/require-session";
import { EFFECTIVENESS_DUE_WHERE } from "@/lib/training";
import { canManageLearningAssignment, canRecordLearningEffectiveness } from "@/lib/permissions";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EffectivenessForm } from "./effectiveness-form";

// TRN-04/TRN-07/TRN-15: "the Primary Position supervisor completes it" — a
// D+30 (or configured interval) follow-up on every COMPLETED assignment
// whose course required effectiveness and hasn't been evaluated yet.
// Training/HR Admin get company-wide VIEW visibility here too (ACC-22
// "administers delivery"), same predicate as the Learning Assignment list —
// but only the actual supervisor (or HR Admin) may submit a result, so the
// form itself is scoped separately, per row, to canRecordLearningEffectiveness.
export default async function EffectivenessTasksPage() {
  const session = await requireSession();
  const canView = canManageLearningAssignment(session);

  if (!canView && !session.user.employeeId) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const candidates = await prisma.learningAssignment.findMany({
    where: EFFECTIVENESS_DUE_WHERE,
    include: {
      employee: { select: { id: true, fullLegalName: true, employeeNumber: true } },
      course: { select: { title: true } },
    },
    orderBy: { effectivenessDueDate: "asc" },
  });

  const tasksWithAuthority = await Promise.all(
    candidates.map(async (c) => {
      const isSupervisor = await isDirectManagerOfEmployee(session.user.employeeId, c.employeeId);
      return { task: c, canSubmit: canRecordLearningEffectiveness(session, isSupervisor), isSupervisor };
    })
  );
  const tasks = canView ? tasksWithAuthority : tasksWithAuthority.filter((t) => t.isSupervisor);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Tugas Evaluasi Efektivitas Pelatihan</h1>
      <p className="mt-1 text-sm text-slate-500">
        Evaluasi ini tidak pernah mengubah hasil penilaian kompetensi yang sudah ada — perbaikan diukur pada siklus penilaian
        berikutnya (COM-12).
      </p>

      <div className="mt-6 space-y-4">
        {tasks.length === 0 && <p className="text-sm text-slate-400">Tidak ada tugas evaluasi efektivitas saat ini.</p>}
        {tasks.map(({ task, canSubmit }) => (
          <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-900">
              {task.employee.fullLegalName}
              <span className="ml-2 text-xs text-slate-400">{task.employee.employeeNumber}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {task.course.title} · Batas waktu: {task.effectivenessDueDate?.toISOString().slice(0, 10) ?? "—"}
            </p>
            {canSubmit ? (
              <div className="mt-3">
                <EffectivenessForm assignmentId={task.id} />
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Hanya atasan Posisi Utama karyawan ini yang dapat mengisi evaluasi.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
