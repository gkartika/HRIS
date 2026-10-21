import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { SCREENING_TONE } from "@/lib/assessment-ui";
import { formatDateTimeMedium } from "@/lib/format";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { t } from "@/lib/i18n/id";
import { canViewAssessmentResults } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";

const STATUSES = ["PRIORITY_REVIEW", "INTERVIEW_ATTENTION", "NO_AGGREGATE_CONCERN"] as const;

export default async function AssessmentResultsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const session = await requireSession();
  const hrManagerIds = (await getActiveHrManagerPositions(session.user.employeeId)).map((p) => p.positionId);
  if (!canViewAssessmentResults(session, hrManagerIds)) return <AccessDenied />;
  const { status: statusRaw, q } = await searchParams;
  const status = STATUSES.find((s) => s === statusRaw);
  const search = q?.trim() ?? "";

  const rows = await prisma.recruitmentAssessmentSubmission.findMany({
    where: {
      ...(status ? { screeningStatus: status } : {}),
      ...(search ? { candidate: { fullName: { contains: search, mode: "insensitive" } } } : {}),
    },
    orderBy: [{ startedAt: "desc" }],
    take: 200,
    include: {
      candidate: { select: { id: true, fullName: true, source: true, employee: { select: { employeeNumber: true } }, request: { select: { job: { select: { jobTitle: true } }, department: { select: { unitName: true } } } } } },
      version: { select: { versionLabel: true } },
      rubric: { select: { rubricLabel: true } },
    },
  });
  const chip = "rounded-full border px-3 py-1.5 text-xs font-medium";

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: t("assessment.rubricNav"), href: "/recruitment/assessment" }, { label: t("assessment.result.title") }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">{t("assessment.result.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{t("assessment.result.disclaimer")}</p>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/recruitment/assessment/results">
        <input name="q" defaultValue={search} placeholder="Cari nama pelamar" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Cari</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Link href={search ? `/recruitment/assessment/results?q=${encodeURIComponent(search)}` : "/recruitment/assessment/results"} className={`${chip} ${!status ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
          Semua
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/recruitment/assessment/results?status=${s}${search ? `&q=${encodeURIComponent(search)}` : ""}`} className={`${chip} ${status === s ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
            {t(`assessment.result.screening.${s}`)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada hasil yang cocok.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Pelamar</th>
                <th className="px-4 py-2 font-medium">Lowongan</th>
                <th className="px-4 py-2 font-medium">Versi</th>
                <th className="px-4 py-2 font-medium">Skor</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Dikirim</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <Link href={`/recruitment/assessment/results/${r.candidate.id}`} className="font-medium text-indigo-700 hover:underline">
                      {r.candidate.fullName}
                    </Link>
                    {r.candidate.source === "INTERNAL" && (
                      <span className="ml-2">
                        <StatusChip tone="bg-indigo-50 text-indigo-700">Internal{r.candidate.employee ? ` · ${r.candidate.employee.employeeNumber}` : ""}</StatusChip>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.candidate.request.job?.jobTitle ?? "-"} · {r.candidate.request.department.unitName}</td>
                  <td className="px-4 py-2 text-slate-600">{r.version.versionLabel} / {r.rubric.rubricLabel}</td>
                  <td className="px-4 py-2 text-slate-800">{r.totalScore ?? "-"}</td>
                  <td className="px-4 py-2">
                    <StatusChip tone={SCREENING_TONE[r.screeningStatus ?? "INCOMPLETE"]}>{t(`assessment.result.screening.${r.screeningStatus ?? "INCOMPLETE"}`)}</StatusChip>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.submittedAt ? formatDateTimeMedium(r.submittedAt) : "Belum dikirim"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
