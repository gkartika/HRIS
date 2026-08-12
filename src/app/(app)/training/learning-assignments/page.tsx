import { requireSession } from "@/lib/require-session";
import { canManageLearningAssignment } from "@/lib/permissions";
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

export default async function LearningAssignmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const session = await requireSession();
  if (!canManageLearningAssignment(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }
  const { status, q } = await searchParams;

  const assignments = await prisma.learningAssignment.findMany({
    where: {
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
      employee: { select: { fullLegalName: true, preferredName: true, employeeNumber: true } },
      course: { select: { title: true, certificateRequired: true } },
      session: { select: { startDate: true } },
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
        <a
          href={`/api/learning-assignments/export${status ? `?status=${status}` : ""}`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Ekspor CSV
        </a>
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
                  <p className="text-slate-900">{a.employee.preferredName ?? a.employee.fullLegalName}</p>
                  <p className="text-xs text-slate-400">{a.employee.employeeNumber}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.course.title}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.session?.startDate.toISOString().slice(0, 10) ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.sourceType === "TRAINING_REQUEST" ? "Permintaan" : "Wajib"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_TONE[a.status]}`}>{a.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {a.status === "ASSIGNED" && <ConfirmAttendanceButton assignmentId={a.id} />}
                  {a.status === "ATTENDED" && <CompleteForm assignmentId={a.id} certificateRequired={a.course.certificateRequired} />}
                  {(a.status === "ASSIGNED" || a.status === "ATTENDED") && <CancelButton assignmentId={a.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
