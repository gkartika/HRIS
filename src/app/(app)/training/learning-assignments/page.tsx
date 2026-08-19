import { requireSession } from "@/lib/require-session";
import { canManageLearningAssignment, canViewCompanyWideLmsReporting } from "@/lib/permissions";
import { areRequiredMaterialsComplete } from "@/lib/lms";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getDirectReportEmployeeIds } from "@/lib/manager-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ConfirmAttendanceButton } from "./confirm-attendance-button";
import { CompleteForm } from "./complete-form";
import { CancelButton } from "./cancel-button";
import type { LearningAssignmentStatus } from "@/generated/prisma/enums";

const STATUS_TONE: Record<string, string> = {
  ASSIGNED: "bg-amber-100 text-amber-700",
  ATTENDED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

// TRN-13/ACC-23 rules section: "Only Training Admin manages courses,
// assignments, attendance, results and certificates" — Manager/HR Manager
// get the same list, scoped to their authority, but every action button is
// hidden for them below (canManage gate). HR Manager's scope is company-
// wide and read-only (canViewCompanyWideLmsReporting); a plain Manager only
// sees their own direct reports' rows (getDirectReportEmployeeIds).
export default async function LearningAssignmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const session = await requireSession();
  const canManage = canManageLearningAssignment(session);
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const activeHrManagerPositionIds = hrManagerPositions.map((p) => p.positionId);
  const isCompanyWideReporting = canViewCompanyWideLmsReporting(session, activeHrManagerPositionIds);
  const directReportIds = canManage || isCompanyWideReporting ? [] : await getDirectReportEmployeeIds(session.user.employeeId);

  if (!canManage && !isCompanyWideReporting && directReportIds.length === 0) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }
  const { status, q } = await searchParams;

  const assignments = await prisma.learningAssignment.findMany({
    where: {
      ...(canManage || isCompanyWideReporting ? {} : { employeeId: { in: directReportIds } }),
      ...(status ? { status: status as LearningAssignmentStatus } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { employee: { fullLegalName: { contains: q.trim() } } },
              { employee: { employeeNumber: { contains: q.trim() } } },
              { course: { title: { contains: q.trim() } } },
            ],
          }
        : {}),
    },
    include: {
      employee: { select: { fullLegalName: true, employeeNumber: true } },
      course: {
        select: {
          title: true,
          certificateRequired: true,
          mode: true,
          materials: { select: { id: true, isRequired: true } },
          quiz: { select: { id: true } },
        },
      },
      session: { select: { startDate: true } },
      materialProgress: { select: { materialId: true } },
      quizAttempts: { select: { passed: true } },
    },
    orderBy: { assignedAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Penugasan Pelatihan (Learning Assignment)</h1>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nama karyawan atau pelatihan"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {["ASSIGNED", "ATTENDED", "COMPLETED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("common.applyFilter")}
        </button>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/learning-assignments/export${status ? `?status=${status}` : ""}`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Ekspor Penugasan
            </a>
            <a
              href="/api/learning-assignments/export/overdue"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Ekspor Terlambat
            </a>
            <a
              href="/api/learning-assignments/export/quiz-results"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Ekspor Hasil Kuis
            </a>
            <a
              href="/api/learning-assignments/export/certificate-expiry"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Ekspor Kedaluwarsa Sertifikat
            </a>
          </div>
        )}
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Karyawan</th>
              <th className="px-4 py-3 font-medium">Pelatihan</th>
              <th className="px-4 py-3 font-medium">Sesi</th>
              <th className="px-4 py-3 font-medium">Sumber</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                  {t("common.noFilteredResults")}
                </td>
              </tr>
            )}
            {assignments.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <p className="text-slate-900">{a.employee.fullLegalName}</p>
                  <p className="text-xs text-slate-400">{a.employee.employeeNumber}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.course.title}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.session?.startDate.toISOString().slice(0, 10) ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.sourceType === "TRAINING_REQUEST" ? "Permintaan" : "Wajib"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_TONE[a.status]}`}>{a.status}</span>
                  {a.course.mode !== "IN_PERSON" && a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Materi{" "}
                      {
                        a.course.materials.filter((m) => a.materialProgress.some((p) => p.materialId === m.id)).length
                      }
                      /{a.course.materials.length}
                      {a.course.quiz ? ` · Kuis: ${a.quizAttempts.some((qa) => qa.passed) ? "Lulus" : "Belum"}` : ""}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <>
                      {a.status === "ASSIGNED" && a.course.mode !== "ONLINE" && <ConfirmAttendanceButton assignmentId={a.id} />}
                      {(a.status === "ATTENDED" || (a.status === "ASSIGNED" && a.course.mode === "ONLINE")) && (
                        <CompleteForm
                          assignmentId={a.id}
                          certificateRequired={a.course.certificateRequired}
                          ready={
                            a.course.mode !== "ONLINE" ||
                            (areRequiredMaterialsComplete(
                              a.course.materials,
                              new Set(a.materialProgress.map((p) => p.materialId))
                            ) &&
                              (!a.course.quiz || a.quizAttempts.some((qa) => qa.passed)))
                          }
                        />
                      )}
                      {(a.status === "ASSIGNED" || a.status === "ATTENDED") && <CancelButton assignmentId={a.id} />}
                    </>
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
