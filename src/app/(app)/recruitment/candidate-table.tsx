import Link from "next/link";
import { StatusChip } from "@/components/status-chip";
import { formatDateMedium } from "@/lib/format";
import { formatMobile } from "@/lib/mobile-number";
import { CANDIDATE_STATUS_LABEL, CANDIDATE_STATUS_TONE } from "@/lib/recruitment-candidates";
import { nextStepOf, testSummary, type CandidateRow } from "@/lib/recruitment-queries";
import { assessmentSummary } from "@/lib/recruitment-assessment";

// The applicant table used by a request's own pipeline and by the Pelamar page.
export function CandidateTable({ rows, showRequest }: { rows: CandidateRow[]; showRequest: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Nama</th>
            {showRequest && <th className="px-3 py-3 font-medium">Permintaan</th>}
            <th className="px-3 py-3 font-medium">Sumber</th>
            <th className="px-3 py-3 font-medium">Tahap</th>
            <th className="px-3 py-3 font-medium">Hasil tes</th>
            <th className="px-3 py-3 font-medium">Langkah berikutnya</th>
            <th className="px-3 py-3 font-medium">Berubah</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const next = nextStepOf(c);
            return (
              <tr key={c.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/recruitment/${c.requestId}/candidates/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                    {c.fullName}
                  </Link>
                  {c.mobileNumber && <div className="mt-0.5 text-xs text-slate-500">{formatMobile(c.mobileNumber)}</div>}
                </td>
                {showRequest && (
                  <td className="px-3 py-3 text-xs text-slate-600">
                    <Link href={`/recruitment/${c.requestId}`} className="font-mono text-indigo-600 hover:underline">
                      {c.request.requestNumber}
                    </Link>
                    <div>{c.request.job?.jobTitle ?? "—"}</div>
                  </td>
                )}
                <td className="px-3 py-3">
                  <StatusChip tone={c.source === "INTERNAL" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}>{c.source === "INTERNAL" ? "Internal" : "Eksternal"}</StatusChip>
                </td>
                <td className="px-3 py-3">
                  <StatusChip tone={CANDIDATE_STATUS_TONE[c.status]}>{CANDIDATE_STATUS_LABEL[c.status]}</StatusChip>
                </td>
                <td className="max-w-[260px] px-3 py-3 text-xs text-slate-600">
                  <div className="font-medium text-slate-800">{assessmentSummary(c.assessment)}</div>
                  {c.tests.length > 0 && <div>{testSummary(c)}</div>}
                </td>
                <td className="px-3 py-3 text-xs">
                  <span className={next.needsAction ? "font-medium text-amber-700" : "text-slate-500"}>{next.label}</span>
                </td>
                <td className="px-3 py-3 text-xs text-slate-400">{formatDateMedium(c.statusChangedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
