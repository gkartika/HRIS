import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageTrainingCourse } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateCourseForm } from "./create-course-form";

export default async function TrainingCoursesPage() {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const courses = await prisma.trainingCourse.findMany({
    where: { activeFlag: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true, learningAssignments: true } } },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("training.coursesTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("training.coursesSubtitle")}</p>

      <div className="mt-4">
        <CreateCourseForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("training.courseTitleLabel")}</th>
              <th className="px-4 py-3 font-medium">{t("training.categoryLabel")}</th>
              <th className="px-4 py-3 font-medium">{t("training.effectivenessRequiredLabel")}</th>
              <th className="px-4 py-3 font-medium">{t("training.sessionsCountLabel")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  Belum ada pelatihan.
                </td>
              </tr>
            )}
            {courses.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{c.title}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{c.category ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{c.effectivenessRequired ? `Ya (D+${c.effectivenessFollowupDays})` : "Tidak"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{c._count.sessions}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/training/courses/${c.id}`} className="text-xs text-indigo-600 hover:underline">
                    Lihat →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
