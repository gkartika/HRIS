import { findCandidateByToken } from "@/lib/recruitment-service";
import { loadAssessmentRunner } from "@/lib/recruitment-assessment-service";
import { t } from "@/lib/i18n/id";
import { AssessmentRunner } from "../../assessment-runner";

export const dynamic = "force-dynamic";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
      <h1 className="text-lg font-bold text-[#231a28]">{title}</h1>
      <p className="mt-1 text-sm text-[#6a5f72]">{body}</p>
    </div>
  );
}

export default async function PublicAssessmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await findCandidateByToken(token);
  const state = candidate ? await loadAssessmentRunner(candidate.id) : null;

  if (!state) return <Notice title="Tautan tidak ditemukan" body="Periksa kembali tautan yang Anda buka, atau lamar ulang dari halaman lowongan." />;
  if (state.kind === "closed") {
    return <Notice title={t("assessment.name")} body={state.reason === "NOT_OPEN" ? t("assessment.candidate.closedNotOpen") : t("assessment.candidate.closedNoRubric")} />;
  }
  return <AssessmentRunner access={{ token }} state={state} />;
}
