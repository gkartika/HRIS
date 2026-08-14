import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canTakeQuiz } from "@/lib/permissions";
import { areRequiredMaterialsComplete, canRetryQuiz } from "@/lib/lms";
import { prisma } from "@/lib/db";
import { MarkMaterialButton } from "./mark-material-button";
import { QuizAttemptForm } from "./quiz-attempt-form";

const MATERIAL_TYPE_LABELS: Record<string, string> = { PDF: "PDF", DOCX: "DOCX", PPTX: "PPTX", VIDEO: "Video", URL: "Tautan" };
const STATUS_LABELS: Record<string, string> = { ASSIGNED: "Berjalan", ATTENDED: "Hadir", COMPLETED: "Selesai", CANCELLED: "Dibatalkan" };
const MODE_LABELS: Record<string, string> = { ONLINE: "Daring", IN_PERSON: "Tatap Muka", BLENDED: "Campuran" };

export default async function MyLearningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const assignment = await prisma.learningAssignment.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          materials: { orderBy: { displayOrder: "asc" } },
          quiz: { include: { questions: { orderBy: { displayOrder: "asc" }, include: { options: { orderBy: { displayOrder: "asc" } } } } } },
        },
      },
      materialProgress: true,
      quizAttempts: { orderBy: { attemptNumber: "desc" } },
    },
  });
  if (!assignment) notFound();
  if (!canTakeQuiz(session, assignment.employeeId)) {
    return <p className="text-sm text-rose-600">Anda tidak memiliki akses ke penugasan ini.</p>;
  }

  const completedMaterialIds = new Set(assignment.materialProgress.map((p) => p.materialId));
  const requiredMaterialsComplete = areRequiredMaterialsComplete(
    assignment.course.materials.map((m) => ({ id: m.id, isRequired: m.isRequired })),
    completedMaterialIds
  );

  const quiz = assignment.course.quiz;
  const hasPassed = assignment.quizAttempts.some((a) => a.passed);
  const attemptsUsed = assignment.quizAttempts.length;
  const canRetry = quiz ? canRetryQuiz(attemptsUsed, quiz.maxAttempts, assignment.quizBonusAttempts) : false;
  const canTakeQuizNow = !!quiz && !hasPassed && canRetry && assignment.status !== "CANCELLED" && assignment.status !== "COMPLETED";

  return (
    <div>
      <Link href="/training/my-learning" className="text-xs text-indigo-600 hover:underline">
        ← Kembali ke Pembelajaran Saya
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-lg font-medium text-slate-900">{assignment.course.title}</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{STATUS_LABELS[assignment.status]}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {MODE_LABELS[assignment.course.mode]}
        {assignment.course.objectives ? ` · ${assignment.course.objectives}` : ""}
      </p>

      <h2 className="mt-6 text-sm font-medium text-slate-900">Materi</h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Judul</th>
              <th className="px-4 py-3 font-medium">Jenis</th>
              <th className="px-4 py-3 font-medium">Wajib</th>
              <th className="px-4 py-3 font-medium">Buka</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {assignment.course.materials.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-xs text-slate-400">
                  Belum ada materi untuk pelatihan ini.
                </td>
              </tr>
            )}
            {assignment.course.materials.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{m.title}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{MATERIAL_TYPE_LABELS[m.materialType]}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{m.isRequired ? "Ya" : "Tidak"}</td>
                <td className="px-4 py-3 text-xs">
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
                <td className="px-4 py-3 text-right">
                  <MarkMaterialButton
                    assignmentId={assignment.id}
                    materialId={m.id}
                    completed={completedMaterialIds.has(m.id)}
                    editable={assignment.status === "ASSIGNED"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {quiz && (
        <>
          <h2 className="mt-6 text-sm font-medium text-slate-900">Kuis</h2>
          <p className="mt-1 text-xs text-slate-500">
            Nilai kelulusan {quiz.passingScorePercent}% · Percobaan digunakan {attemptsUsed} dari{" "}
            {quiz.maxAttempts + assignment.quizBonusAttempts}
            {hasPassed ? " · Sudah lulus" : ""}
          </p>

          {assignment.quizAttempts.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Percobaan</th>
                    <th className="px-4 py-3 font-medium">Skor</th>
                    <th className="px-4 py-3 font-medium">Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {assignment.quizAttempts.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-xs text-slate-600">#{a.attemptNumber}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{a.scorePercent?.toFixed(1) ?? "—"}%</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={a.passed ? "font-medium text-emerald-700" : "font-medium text-rose-600"}>
                          {a.passed ? "Lulus" : "Tidak Lulus"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!requiredMaterialsComplete && !hasPassed && (
            <p className="mt-2 text-xs text-amber-600">Selesaikan seluruh materi wajib sebelum mengambil kuis.</p>
          )}
          {canTakeQuizNow && requiredMaterialsComplete && (
            <div className="mt-2">
              <QuizAttemptForm
                assignmentId={assignment.id}
                questions={quiz.questions.map((q) => ({
                  id: q.id,
                  questionText: q.questionText,
                  questionType: q.questionType,
                  options: q.options.map((o) => ({ id: o.id, optionText: o.optionText })),
                }))}
              />
            </div>
          )}
          {!canRetry && !hasPassed && (
            <p className="mt-2 text-xs text-rose-600">Batas percobaan kuis sudah tercapai. Hubungi Training Admin.</p>
          )}
        </>
      )}

      {(assignment.course.mode === "IN_PERSON" || assignment.course.mode === "BLENDED") && (
        <>
          <h2 className="mt-6 text-sm font-medium text-slate-900">Kehadiran</h2>
          <p className="mt-1 text-xs text-slate-500">
            {assignment.attendanceConfirmedAt
              ? `Kehadiran dikonfirmasi oleh Training Admin pada ${assignment.attendanceConfirmedAt.toISOString().slice(0, 10)}`
              : "Kehadiran belum dikonfirmasi oleh Training Admin."}
          </p>
        </>
      )}

      {assignment.status === "COMPLETED" && (
        <>
          <h2 className="mt-6 text-sm font-medium text-slate-900">Sertifikat</h2>
          {assignment.certificateFileId || assignment.certificateNumber ? (
            <div className="mt-1 text-xs text-slate-600">
              {assignment.certificateNumber && <p>No. Sertifikat: {assignment.certificateNumber}</p>}
              {assignment.certificateExpiryDate && <p>Berlaku hingga: {assignment.certificateExpiryDate.toISOString().slice(0, 10)}</p>}
              {assignment.certificateFileId && (
                <a href={`/api/files/${assignment.certificateFileId}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                  Unduh Sertifikat
                </a>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Belum ada sertifikat untuk pelatihan ini.</p>
          )}
        </>
      )}
    </div>
  );
}
