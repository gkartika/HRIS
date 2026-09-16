import { requireSession } from "@/lib/require-session";
import { canManageExitClearanceQuestions } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateExitClearanceQuestionForm } from "./create-form";
import { ToggleActiveForm } from "./toggle-form";
import { MoveButtons } from "./move-buttons";

export default async function ExitClearanceQuestionsPage() {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const questions = await prisma.exitClearanceQuestion.findMany({
    orderBy: { displayOrder: "asc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Pertanyaan Klirens Keluar</h1>
      <p className="mt-1 text-sm text-slate-500">
        Daftar pertanyaan pada formulir Klirens Keluar yang diisi sendiri oleh karyawan yang mengundurkan diri/berakhir
        masa kerjanya. Hanya pertanyaan yang berstatus Aktif yang ditampilkan pada formulir.
      </p>

      <div className="mt-4">
        <CreateExitClearanceQuestionForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Pertanyaan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {questions.map((q, index) => (
              <tr key={q.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-700">{q.questionText}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      q.activeFlag ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {q.activeFlag ? t("common.active") : t("common.inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <ToggleActiveForm questionId={q.id} currentActive={q.activeFlag} />
                </td>
                <td className="px-4 py-3">
                  <MoveButtons questionId={q.id} canMoveUp={index > 0} canMoveDown={index < questions.length - 1} />
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                  Belum ada pertanyaan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
