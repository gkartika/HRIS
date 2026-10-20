import Link from "next/link";
import { ACTIVE_CANDIDATE_STATUSES } from "@/lib/recruitment-candidates";
import { listCandidates, waitingApplicantGroups } from "@/lib/recruitment-queries";

// Beranda block for Admin Rekrutmen: how many applicants are in the pipeline and, per
// request, who is waiting for the next step. (Admin SDM sees the same rows in its own
// "Perlu ditindak" board.)
export async function RecruitmentAdminHome() {
  const rows = await listCandidates({ status: { in: ACTIVE_CANDIDATE_STATUSES } }, 400);
  const groups = waitingApplicantGroups(rows);
  const waiting = groups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Pelamar</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {rows.length} pelamar dalam proses, {waiting} menunggu tindakan Anda.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/recruitment/applicants" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Buka Pelamar
          </Link>
          <Link href="/recruitment/settings" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Pengaturan
          </Link>
        </div>
      </div>
      {groups.length > 0 && (
        <div className="mt-4 divide-y divide-slate-100">
          {groups.map((g) => (
            <div key={g.requestId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {g.count} pelamar menunggu: {g.label}
                </p>
                <p className="text-xs text-slate-500">
                  {g.requestNumber} · {g.firstStep}
                </p>
              </div>
              <Link href={`/recruitment/${g.requestId}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-slate-50">
                Buka
              </Link>
            </div>
          ))}
        </div>
      )}
      {groups.length === 0 && <p className="mt-4 text-sm text-slate-400">Tidak ada pelamar yang menunggu tindakan.</p>}
    </div>
  );
}
