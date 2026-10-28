import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { canManageRecruitment } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { TEST_FORM_LABEL } from "@/lib/recruitment-candidates";
import { bulkAddQuestionsAction, deleteQuestionAction, saveQuestionAction, toggleQuestionAction } from "../../actions";
import { ActionForm, ConfirmAction, RunButton } from "../../settings-forms";
import { QuestionFields } from "./question-fields";
import { QuestionPreview } from "./question-preview";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const lab = "mb-1 block text-xs text-slate-500";
export default async function TestQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageRecruitment(session)) return <AccessDenied />;

  const type = await prisma.recruitmentTestType.findUnique({
    where: { id },
    include: { questions: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { answers: true } } } } },
  });
  if (!type) notFound();
  const activeIds = type.questions.filter((q) => q.active).map((q) => q.id);
  const active = activeIds.length;
  // "Soal 2 dari 4" counts the active questions, the same way an applicant sees them.
  const labelOf = (questionId: string) => (activeIds.includes(questionId) ? `Soal ${activeIds.indexOf(questionId) + 1} dari ${active}` : "Soal nonaktif, tidak tampil ke pelamar");

  const bulkHelp =
    type.form === "MULTIPLE_CHOICE"
      ? "Satu soal per baris dengan format:  Soal | opsi A; opsi B; opsi C | nomor jawaban benar.  Contoh:  Berapa 148 + 275? | 413; 423; 433 | 2"
      : type.form === "SCALE"
        ? "Satu pernyataan per baris. Pelamar menjawab dengan skala 1 (sangat tidak setuju) sampai 5 (sangat setuju)."
        : "Satu soal esai per baris.";

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: "Pengaturan Rekrutmen", href: "/recruitment/settings" }, { label: type.name }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-lg font-medium text-slate-900">Soal: {type.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {TEST_FORM_LABEL[type.form]} · {type.timeLimitMinutes} menit · {type.form === "ESSAY" ? "dinilai reviewer" : `lulus ${type.passScore}%`} · {active} soal aktif dari {type.questions.length}
        </p>
        {active === 0 && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Tes ini belum punya soal aktif. Lowongan yang memakainya belum bisa menerima pelamar.</p>}
      </div>

      <div className="space-y-3">
        {type.questions.map((q, i) => (
          <div key={q.id} className={`rounded-xl border bg-white p-4 ${q.active ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-2 font-mono text-xs text-slate-400">{i + 1}.</p>
                <QuestionPreview form={type.form} monospace={type.monospace} prompt={q.prompt} options={q.options} label={labelOf(q.id)} />
                {type.form === "MULTIPLE_CHOICE" && q.correctIndex !== null && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Jawaban benar (hanya terlihat HR): {q.correctIndex + 1}. {q.options[q.correctIndex]}
                  </p>
                )}
                {q.reverseScored && <p className="mt-1 text-xs text-amber-700">Pernyataan terbalik</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {!q.active && <StatusChip tone="bg-slate-100 text-slate-500">Nonaktif</StatusChip>}
                <RunButton label={q.active ? "Nonaktifkan" : "Aktifkan"} action={toggleQuestionAction.bind(null, q.id)} />
                <ConfirmAction label="Hapus" confirmLabel="Ya, hapus soal" action={deleteQuestionAction.bind(null, q.id)} />
              </div>
            </div>
            {q._count.answers > 0 ? (
              <p className="mt-2 text-[11px] text-slate-400">Sudah dijawab {q._count.answers} kali, jadi tidak bisa diubah atau dihapus. Nonaktifkan lalu buat soal baru.</p>
            ) : (
              <details className="mt-2 rounded-lg border border-slate-100 p-3">
                <summary className="cursor-pointer text-xs font-medium text-indigo-600">Ubah soal</summary>
                <div className="mt-3">
                  <ActionForm action={saveQuestionAction.bind(null, type.id, q.id)} submitLabel="Simpan soal">
                    <QuestionFields form={type.form} monospace={type.monospace} defaults={q} idPrefix={`q-${q.id}`} label={labelOf(q.id)} />
                  </ActionForm>
                </div>
              </details>
            )}
          </div>
        ))}
        {type.questions.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">Belum ada soal. Tambahkan di bawah.</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Tambah satu soal</h2>
        <div className="mt-3">
          <ActionForm action={saveQuestionAction.bind(null, type.id, null)} submitLabel="Tambah soal" resetOnSuccess>
            <QuestionFields form={type.form} monospace={type.monospace} idPrefix="new" label={`Soal ${active + 1} dari ${active + 1}`} />
          </ActionForm>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Tempel banyak soal sekaligus</h2>
        <p className="mt-0.5 text-xs text-slate-500">{bulkHelp}</p>
        <div className="mt-3">
          <ActionForm action={bulkAddQuestionsAction.bind(null, type.id)} submitLabel="Simpan semua soal" resetOnSuccess>
            <label className={lab} htmlFor="bulk-lines">Soal (satu per baris)</label>
            <textarea id="bulk-lines" name="lines" rows={8} required className={`${field} font-mono`} />
          </ActionForm>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Jika ada satu baris yang salah format, tidak ada soal yang disimpan dan baris yang salah disebutkan.</p>
      </div>
    </div>
  );
}
