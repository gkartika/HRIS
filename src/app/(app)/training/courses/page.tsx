import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageTrainingCourse } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateCourseForm } from "./create-course-form";

const STATUS_LABELS: Record<string, string> = { DRAFT: "Draft", PUBLISHED: "Dipublikasikan", ARCHIVED: "Diarsipkan" };
const MODE_LABELS: Record<string, string> = { ONLINE: "Daring", IN_PERSON: "Tatap Muka", BLENDED: "Campuran" };

export default async function TrainingCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; mode?: string }>;
}) {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }
  const { q, status, mode } = await searchParams;

  // Training Admin's own authoring library shows every status (Draft is
  // exactly where new courses start) — unlike every other consumer, which
  // must only ever offer PUBLISHED courses for assignment.
  const courses = await prisma.trainingCourse.findMany({
    where: {
      ...(q?.trim() ? { title: { contains: q.trim() } } : {}),
      ...(status ? { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" } : {}),
      ...(mode ? { mode: mode as "ONLINE" | "IN_PERSON" | "BLENDED" } : {}),
    },
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

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Judul pelatihan"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Mode</label>
          <select name="mode" defaultValue={mode ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("common.applyFilter")}
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("training.courseTitleLabel")}</th>
              <th className="px-4 py-3 font-medium">{t("training.categoryLabel")}</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">{t("training.effectivenessRequiredLabel")}</th>
              <th className="px-4 py-3 font-medium">{t("training.sessionsCountLabel")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                  Belum ada pelatihan.
                </td>
              </tr>
            )}
            {courses.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">
                  {c.title}
                  {c.isOnboardingRequired && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Onboarding
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{c.category ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{MODE_LABELS[c.mode]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === "PUBLISHED"
                        ? "bg-emerald-100 text-emerald-700"
                        : c.status === "ARCHIVED"
                          ? "bg-slate-200 text-slate-600"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
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
