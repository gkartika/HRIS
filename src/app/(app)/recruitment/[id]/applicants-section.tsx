import Link from "next/link";
import { appBaseUrl } from "@/lib/mailer";
import { loadPlanContext, plannedTests, readinessProblems } from "@/lib/recruitment-service";
import { listCandidates, STAGE_FILTERS, statusesForStage } from "@/lib/recruitment-queries";
import { TEST_FORM_LABEL } from "@/lib/recruitment-candidates";
import { CandidateTable } from "../candidate-table";
import { OpenForControl } from "../candidate-forms";
import type { RecruitmentOpenFor, RecruitmentRequestStatus } from "@/generated/prisma/enums";

// "Pelamar" block on a request's page (HR Admin only; the page checks that before
// rendering this): who may apply, the access code, what is still missing, and the
// applicant table with its stage filter.
export async function ApplicantsSection({
  request,
  filledCount,
  stage,
}: {
  request: {
    id: string;
    jobId: string | null;
    status: RecruitmentRequestStatus;
    openFor: RecruitmentOpenFor;
    accessCode: string | null;
    requestedHeadcount: number;
  };
  filledCount: number;
  stage: string | undefined;
}) {
  const [ctx, all] = await Promise.all([loadPlanContext(), listCandidates({ requestId: request.id })]);
  const problems = readinessProblems(ctx, request, filledCount);
  const planned = request.jobId ? plannedTests(ctx, request.jobId) : [];
  const wanted = statusesForStage(stage);
  const rows = wanted ? all.filter((c) => wanted.includes(c.status)) : all;
  const countOf = (statuses: string[]) => all.filter((c) => statuses.includes(c.status)).length;
  const publicUrl = `${appBaseUrl()}/cbp-recruitment/apply/${request.id}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-900">Pelamar</h2>
        <Link href="/recruitment/settings" className="text-xs font-medium text-indigo-600 hover:underline">
          Pengaturan Rekrutmen (tes, soal, interview, pesan)
        </Link>
      </div>

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <OpenForControl requestId={request.id} openFor={request.openFor} accessCode={request.accessCode} publicUrl={publicUrl} />
        {planned.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Tes untuk lowongan ini: {planned.map((p) => `${p.name} (${TEST_FORM_LABEL[p.form]}, ${p.timeLimitMinutes} menit, ${p.activeQuestions} soal)`).join(" → ")}.{" "}
            Tes per jabatan diatur di Pengaturan Rekrutmen.
          </p>
        )}
        {request.openFor !== "NONE" && problems.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">Belum bisa menerima pelamar:</p>
            <ul className="mt-1 list-disc pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {request.openFor === "NONE" && <p className="mt-3 text-xs text-slate-500">Lowongan belum dipublikasikan. Pilih untuk siapa lowongan ini dibuka.</p>}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/recruitment/${request.id}`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!wanted ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
        >
          Semua ({all.length})
        </Link>
        {STAGE_FILTERS.map((s) => (
          <Link
            key={s.key}
            href={`/recruitment/${request.id}?stage=${s.key}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${stage === s.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            {s.label} ({countOf(s.statuses)})
          </Link>
        ))}
      </div>

      <div className="mt-3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            {all.length === 0 ? "Belum ada pelamar." : "Tidak ada pelamar di tahap ini."}
          </p>
        ) : (
          <CandidateTable rows={rows} showRequest={false} />
        )}
      </div>
    </div>
  );
}
