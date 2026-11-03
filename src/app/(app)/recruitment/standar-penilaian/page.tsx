import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { canManageRecruitment } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { hasRecruitmentTasks } from "@/lib/recruitment-queries";
import { loadGuide } from "@/lib/interview-standard-queries";
import { SCORE_LABEL, SCORE_STEPS } from "@/lib/interview-matrix";
import { PrintButton } from "./print-button";

// The whole interview standard on one page, as the paper matrix: for reading and printing. Admin Rekrutmen and everyone
// appointed as interviewer may open it.
export default async function InterviewStandardPage({ searchParams }: { searchParams: Promise<{ aspek?: string }> }) {
  const session = await requireSession();
  if (!canManageRecruitment(session) && !(await hasRecruitmentTasks(session.user.employeeId))) return <AccessDenied />;
  const { aspek } = await searchParams;
  const guide = await loadGuide();
  const only = guide.aspects.find((a) => a.id === aspek)?.id ?? null;
  const aspects = guide.aspects.filter((a) => !only || a.id === only);
  const meta = [
    guide.header.docNumber && `No. Dokumen: ${guide.header.docNumber}`,
    guide.header.revision && `No. Revisi: ${guide.header.revision}`,
    guide.header.effectiveDate && `Tgl Berlaku: ${guide.header.effectiveDate}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`;

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Breadcrumbs items={[{ label: "Rekrutmen", href: "/recruitment" }, { label: "Standar penilaian interview" }]} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PT Cahaya Bukit Perunggu</p>
          <h1 className="text-lg font-semibold text-slate-900">Matriks Penilaian Hasil Wawancara Calon Tenaga Kerja</h1>
          {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
        </div>
        <PrintButton />
      </div>
      <div className="flex flex-wrap gap-1.5 print:hidden">
        <Link href="/recruitment/standar-penilaian" className={chip(only === null)}>
          Semua aspek
        </Link>
        {guide.aspects.map((a) => (
          <Link key={a.id} href={`/recruitment/standar-penilaian?aspek=${a.id}`} className={chip(only === a.id)}>
            {a.label}
          </Link>
        ))}
      </div>

      {aspects.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">Standar penilaian belum diisi. Admin Rekrutmen mengisinya di Pengaturan Rekrutmen, tab Interview.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white print:border-0">
          <table className="w-full min-w-[900px] border-collapse text-xs print:min-w-0">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="w-44 border border-slate-200 p-2">Aspek dan definisi</th>
                {SCORE_STEPS.map((n) => (
                  <th key={n} className="border border-slate-200 p-2">
                    {n} · {SCORE_LABEL[n]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="align-top text-slate-700">
              {aspects.map((a, i) => (
                <tr key={a.id} className="break-inside-avoid">
                  <td className="border border-slate-200 p-2">
                    <b className="text-slate-900">
                      {i + 1}. {a.label}
                    </b>
                    {a.optional && <span className="ml-1 text-slate-500">(opsional)</span>}
                    {a.standard?.definition && <span className="mt-1 block">{a.standard.definition}</span>}
                    {a.standard?.note && <span className="mt-1 block font-medium text-amber-800">{a.standard.note}</span>}
                  </td>
                  {SCORE_STEPS.map((n) => (
                    <td key={n} className="border border-slate-200 p-2">
                      {a.standard?.levels.find((l) => l.score === n)?.description ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">Setiap penilai memilih satu skor (2, 4, 6, 8 atau 10) pada tiap aspek.</p>
    </div>
  );
}
