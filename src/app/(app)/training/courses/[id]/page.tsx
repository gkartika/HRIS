import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageTrainingCourse } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateSessionForm } from "./create-session-form";

export default async function TrainingCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const course = await prisma.trainingCourse.findUnique({
    where: { id },
    include: { sessions: { orderBy: { startDate: "desc" }, include: { _count: { select: { learningAssignments: true } } } } },
  });
  if (!course) notFound();

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{course.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {course.category ?? "—"} · {course.provider ?? "—"} · {course.deliveryMethod ?? "—"}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {course.effectivenessRequired ? `Evaluasi efektivitas D+${course.effectivenessFollowupDays}` : "Tanpa evaluasi efektivitas"}
        {course.certificateRequired ? " · Ada Sertifikat" : ""}
      </p>

      <h2 className="mt-6 text-sm font-medium text-slate-900">Sesi</h2>
      <div className="mt-2">
        <CreateSessionForm courseId={course.id} />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">Lokasi</th>
              <th className="px-4 py-3 font-medium">Kapasitas</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Peserta</th>
            </tr>
          </thead>
          <tbody>
            {course.sessions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-xs text-slate-400">
                  Belum ada sesi.
                </td>
              </tr>
            )}
            {course.sessions.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{s.startDate.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{s.location ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{s.capacity ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{s.status}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{s._count.learningAssignments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
