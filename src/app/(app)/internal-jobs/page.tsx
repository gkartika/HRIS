import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { isActiveCandidateStatus } from "@/lib/recruitment-candidates";
import { listOpenVacancies } from "@/lib/recruitment-service";
import { t } from "@/lib/i18n/id";
import { ApplyInternalButton } from "./apply-button";
import type { RecruitmentCandidateStatus } from "@/generated/prisma/enums";

// What an employee may see about their own application: where they are, never scores
// or the reason (HR gives results in person).
function ownStatus(status: RecruitmentCandidateStatus): { label: string; tone: string } {
  if (status === "TESTING") return { label: "Sedang tes", tone: "bg-slate-100 text-slate-600" };
  if (status === "HIRED") return { label: "Selesai: posisi baru berlaku", tone: "bg-emerald-50 text-emerald-700" };
  if (isActiveCandidateStatus(status)) return { label: "Dalam proses", tone: "bg-indigo-50 text-indigo-700" };
  return { label: "Proses selesai. Hubungi HR untuk hasilnya.", tone: "bg-slate-100 text-slate-500" };
}

export default async function InternalJobsPage() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return <AccessDenied />;

  const [vacancies, mine] = await Promise.all([
    listOpenVacancies("INTERNAL"),
    prisma.recruitmentCandidate.findMany({
      where: { employeeId, source: "INTERNAL" },
      orderBy: { createdAt: "desc" },
      select: { id: true, requestId: true, status: true, createdAt: true, request: { select: { job: { select: { jobTitle: true } }, department: { select: { unitName: true } } } } },
    }),
  ]);
  const appliedTo = new Set(mine.filter((m) => isActiveCandidateStatus(m.status)).map((m) => m.requestId));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Beranda", href: "/dashboard" }, { label: "Lowongan Internal" }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">Lowongan Internal</h1>
        <p className="mt-1 text-sm text-slate-500">Lowongan yang dibuka untuk karyawan PT CBP. Melamar tidak memberi tahu atasan Anda.</p>
      </div>

      {mine.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">Lamaran saya</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {mine.map((m) => {
              const s = ownStatus(m.status);
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{m.request.job?.jobTitle ?? "Lowongan"}</p>
                    <p className="text-xs text-slate-500">{m.request.department.unitName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ${s.tone}`}>{s.label}</span>
                    {m.status === "TESTING" && (
                      <Link href={`/internal-jobs/tes/${m.id}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                        Lanjutkan tes
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vacancies.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Saat ini tidak ada lowongan internal yang terbuka.</p>
      ) : (
        <div className="space-y-4">
          {vacancies.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{v.job?.jobTitle}</h2>
                  <p className="text-sm text-slate-500">
                    {v.department.unitName} · {t(`shiftCode.${v.shiftCode}`)} · {t(`requestedJobLevel.${v.requestedJobLevel}`)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Pendidikan: {t(`educationRequirementCode.${v.educationRequirementCode}`)} · Pengalaman: {t(`workExperienceBand.${v.workExperienceBand}`)}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{v.jobDescriptionSnapshot}</p>
              <div className="mt-4">
                {appliedTo.has(v.id) ? (
                  <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">Anda sudah melamar</span>
                ) : (
                  <ApplyInternalButton requestId={v.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
