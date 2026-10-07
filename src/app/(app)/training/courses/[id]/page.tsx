import { COURSE_STATUS_LABEL } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageTrainingCourse } from "@/lib/permissions";
import { canPublishCourse, canArchiveCourse } from "@/lib/lms";
import { prisma } from "@/lib/db";
import { CreateSessionForm } from "./create-session-form";
import { AddMaterialForm } from "./add-material-form";
import { MaterialMoveButtons } from "./material-move-buttons";
import { CreateQuizForm } from "./create-quiz-form";
import { AddQuestionForm } from "./add-question-form";
import { PublishArchiveButtons } from "./publish-archive-buttons";
import { Breadcrumbs } from "@/components/breadcrumbs";

const MODE_LABELS: Record<string, string> = { ONLINE: "Daring", IN_PERSON: "Tatap Muka", BLENDED: "Campuran" };
const MATERIAL_TYPE_LABELS: Record<string, string> = { PDF: "PDF", DOCX: "DOCX", PPTX: "PPTX", VIDEO: "Video", URL: "Tautan" };
const QUESTION_TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: "Pilihan Tunggal",
  MULTIPLE_CHOICE: "Pilihan Ganda",
  TRUE_FALSE: "Benar/Salah",
};

export default async function TrainingCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) {
    return <AccessDenied />;
  }

  const course = await prisma.trainingCourse.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { startDate: "desc" }, include: { _count: { select: { learningAssignments: true } } } },
      materials: { orderBy: { displayOrder: "asc" } },
      quiz: { include: { questions: { orderBy: { displayOrder: "asc" }, include: { options: { orderBy: { displayOrder: "asc" } } } } } },
    },
  });
  if (!course) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Pelatihan", href: "/training/courses" }, { label: "Detail Pelatihan" }]} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium text-slate-900">{course.title}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                course.status === "PUBLISHED"
                  ? "bg-emerald-100 text-emerald-700"
                  : course.status === "ARCHIVED"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {COURSE_STATUS_LABEL[course.status]}
            </span>
            {course.isOnboardingRequired && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Wajib Onboarding
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {course.category ?? "—"} · {course.provider ?? "—"} · {course.deliveryMethod ?? "—"} · {MODE_LABELS[course.mode]}
          </p>
          {course.objectives && <p className="mt-1 text-xs text-slate-500">{course.objectives}</p>}
          <p className="mt-1 text-xs text-slate-400">
            {course.effectivenessRequired ? `Evaluasi efektivitas D+${course.effectivenessFollowupDays}` : "Tanpa evaluasi efektivitas"}
            {course.certificateRequired ? " · Ada Sertifikat" : ""}
          </p>
        </div>
        <PublishArchiveButtons courseId={course.id} canPublish={canPublishCourse(course.status)} canArchive={canArchiveCourse(course.status)} />
      </div>

      <h2 className="mt-6 text-sm font-medium text-slate-900">Materi Pelatihan</h2>
      <div className="mt-2">
        <AddMaterialForm courseId={course.id} />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Judul</th>
              <th className="px-4 py-3 font-medium">Jenis</th>
              <th className="px-4 py-3 font-medium">Wajib</th>
              <th className="px-4 py-3 font-medium">Tautan/Berkas</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {course.materials.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-xs text-slate-400">
                  Belum ada materi.
                </td>
              </tr>
            )}
            {course.materials.map((m, idx) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{m.title}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{MATERIAL_TYPE_LABELS[m.materialType]}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{m.isRequired ? "Ya" : "Tidak"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {m.fileId ? (
                    <a href={`/api/files/${m.fileId}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      Unduh
                    </a>
                  ) : (
                    <a href={m.externalUrl ?? "#"} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      Buka Tautan
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <MaterialMoveButtons materialId={m.id} canMoveUp={idx > 0} canMoveDown={idx < course.materials.length - 1} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-6 text-sm font-medium text-slate-900">Kuis</h2>
      {!course.quiz ? (
        <div className="mt-2">
          <CreateQuizForm courseId={course.id} />
        </div>
      ) : (
        <div className="mt-2 space-y-4">
          <p className="text-xs text-slate-500">
            Nilai kelulusan {course.quiz.passingScorePercent}% · Batas percobaan {course.quiz.maxAttempts}
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Pertanyaan</th>
                  <th className="px-4 py-3 font-medium">Tipe</th>
                  <th className="px-4 py-3 font-medium">Poin</th>
                  <th className="px-4 py-3 font-medium">Pilihan</th>
                </tr>
              </thead>
              <tbody>
                {course.quiz.questions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-xs text-slate-400">
                      Belum ada pertanyaan.
                    </td>
                  </tr>
                )}
                {course.quiz.questions.map((q) => (
                  <tr key={q.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-900">{q.questionText}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{QUESTION_TYPE_LABELS[q.questionType]}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{q.points}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {q.options.map((o) => (
                        <span key={o.id} className={`mr-2 ${o.isCorrect ? "font-medium text-emerald-700" : ""}`}>
                          {o.optionText}
                          {o.isCorrect ? " ✓" : ""}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AddQuestionForm quizId={course.quiz.id} />
        </div>
      )}

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
