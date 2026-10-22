import Link from "next/link";
import { appBaseUrl } from "@/lib/mailer";
import { loadPlanContext, possibleTests, readinessProblems } from "@/lib/recruitment-service";
import { listCandidates, STAGE_FILTERS, statusesForStage } from "@/lib/recruitment-queries";
import { groupTestColumns, TEST_FORM_LABEL, testIdsForRequest } from "@/lib/recruitment-candidates";
import { CandidateTable } from "../candidate-table";
import { OpenForControl, RequestTestsControl } from "../candidate-forms";
import { VacancyDetailCard } from "./vacancy-detail";
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
    heldAt: Date | null;
    jobTitle: string;
    publicTitle: string | null;
    publicDescription: string | null;
    publicRequirements: string | null;
    internalDescription: string;
    internalCriteria: string | null;
    status: RecruitmentRequestStatus;
    openFor: RecruitmentOpenFor;
    accessCode: string | null;
    requestedHeadcount: number;
    testsCustomized: boolean;
    testTypeIds: string[];
  };
  filledCount: number;
  stage: string | undefined;
}) {
  const [ctx, all] = await Promise.all([loadPlanContext(), listCandidates({ requestId: request.id })]);
  const problems = readinessProblems(ctx, request, filledCount);
  const planned = request.jobId ? possibleTests(ctx, request) : [];
  const columns = groupTestColumns(ctx.types.filter((t) => !t.isGate && t.active));
  const keysOf = (ids: string[]) => columns.filter((c) => c.ids.some((id) => ids.includes(id))).map((c) => c.key);
  const jobDefaultIds = request.jobId ? ctx.jobTestIds.get(request.jobId) ?? [] : [];
  const currentKeys = keysOf(testIdsForRequest(request, jobDefaultIds));
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

      <div className="mt-4 space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <VacancyDetailCard
          key={`${request.publicTitle}|${request.publicDescription}|${request.publicRequirements}`}
          requestId={request.id}
          jobTitle={request.jobTitle}
          saved={{ title: request.publicTitle, description: request.publicDescription, requirements: request.publicRequirements }}
          internalDescription={request.internalDescription}
          internalCriteria={request.internalCriteria}
        />
        <RequestTestsControl
          key={`${request.testsCustomized}:${currentKeys.join(",")}`}
          requestId={request.id}
          columns={columns}
          jobDefaultKeys={keysOf(jobDefaultIds)}
          customized={request.testsCustomized}
          selectedKeys={currentKeys}
        />
        <OpenForControl requestId={request.id} openFor={request.openFor} accessCode={request.accessCode} publicUrl={publicUrl} />
        {planned.length > 0 && (
          <p className="text-xs text-slate-500">
            Urutan tes pelamar: {planned.map((p) => `${p.name} (${TEST_FORM_LABEL[p.form]}, ${p.timeLimitMinutes} menit, ${p.activeQuestions} soal)`).join(" → ")}. Set alternatif dibagi bergantian ke tiap pelamar.
          </p>
        )}
        {request.openFor !== "NONE" && problems.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">Belum bisa menerima pelamar:</p>
            <ul className="mt-1 list-disc pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {request.openFor === "NONE" && <p className="text-xs text-slate-500">Lowongan belum dipublikasikan. Pilih untuk siapa lowongan ini dibuka.</p>}
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
