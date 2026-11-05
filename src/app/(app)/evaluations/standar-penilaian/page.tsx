import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { prisma } from "@/lib/db";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isHrAdmin } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { PERFORMANCE_GRADE_NAME, PERFORMANCE_SCALE, TATA_NILAI_SCALE } from "@/lib/evaluation";
import { textLines } from "@/lib/evaluation-standard";
import { loadEvaluationGuide, type GuideCriterion } from "@/lib/evaluation-standard-queries";
import { PrintButton } from "./print-button";

function Cell({ text }: { text: string | undefined }) {
  const lines = text ? textLines(text) : [];
  if (lines.length === 0) return null;
  if (lines.length === 1) return <>{lines[0]}</>;
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

function Table({ title, criteria, scale, names }: { title: string; criteria: GuideCriterion[]; scale: readonly number[]; names: boolean }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white print:border-0">
        <table className="w-full min-w-[900px] border-collapse text-xs print:min-w-0">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="w-48 border border-slate-200 p-2">Kriteria dan definisi</th>
              {scale.map((n) => (
                <th key={n} className="border border-slate-200 p-2">
                  {n}
                  {names && PERFORMANCE_GRADE_NAME[n] ? ` · ${PERFORMANCE_GRADE_NAME[n]}` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="align-top text-slate-700">
            {criteria.flatMap((c, ci) =>
              c.variants.map((v, vi) => (
                <tr key={`${c.key}-${v.key}`} className="break-inside-avoid">
                  <td className="border border-slate-200 p-2">
                    {vi === 0 && (
                      <>
                        <b className="text-slate-900">
                          {ci + 1}. {c.label}
                        </b>
                        {c.definition && <span className="mt-1 block">{c.definition}</span>}
                        {c.note && <span className="mt-1 block font-medium text-amber-800">{c.note}</span>}
                      </>
                    )}
                    {v.label && <span className="mt-1 block font-semibold text-indigo-700">{v.label}</span>}
                  </td>
                  {scale.map((n) => (
                    <td key={n} className="border border-slate-200 p-2">
                      <Cell text={v.levels.find((l) => l.score === n)?.description} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The whole evaluation standard on one page, as the paper matrix: for reading and printing. Admin SDM, the HR Manager and
// everyone appointed to evaluate someone may open it.
export default async function EvaluationStandardPage() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  const allowed =
    isHrAdmin(session) ||
    (await getActiveHrManagerPositions(employeeId)).length > 0 ||
    (await prisma.evaluation.count({ where: { OR: [{ p1EmployeeId: employeeId }, { p2EmployeeId: employeeId }] } })) > 0;
  if (!allowed) return <AccessDenied />;

  const guide = await loadEvaluationGuide();
  const meta = [
    guide.header.docNumber && `No. Dokumen: ${guide.header.docNumber}`,
    guide.header.revision && `No. Revisi: ${guide.header.revision}`,
    guide.header.effectiveDate && `Tgl Berlaku: ${guide.header.effectiveDate}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const empty = guide.performance.length === 0 && guide.tataNilai.length === 0;

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Breadcrumbs items={[{ label: "Evaluasi", href: "/evaluations" }, { label: "Standar penilaian" }]} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PT Cahaya Bukit Perunggu</p>
          <h1 className="text-lg font-semibold text-slate-900">Matriks Evaluasi Kinerja Karyawan</h1>
          {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
        </div>
        <PrintButton />
      </div>
      {empty ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">Standar penilaian belum diisi. Admin SDM mengisinya di Pengaturan Evaluasi.</p>
      ) : (
        <>
          {guide.performance.length > 0 && <Table title="Bagian 1 — Performance (nilai 2, 4, 6, 8, 10)" criteria={guide.performance} scale={PERFORMANCE_SCALE} names />}
          {guide.tataNilai.length > 0 && <Table title="Bagian 2 — Tata Nilai (nilai 0, 25, 50, 75, 100)" criteria={guide.tataNilai} scale={TATA_NILAI_SCALE} names={false} />}
        </>
      )}
    </div>
  );
}
