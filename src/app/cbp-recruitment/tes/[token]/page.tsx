import Link from "next/link";
import { findCandidateByToken, loadRunnerState } from "@/lib/recruitment-service";
import { assessmentEntryState } from "@/lib/recruitment-assessment-service";
import { t } from "@/lib/i18n/id";
import { TestRunner } from "../../test-runner";

export const dynamic = "force-dynamic";

export default async function PublicTestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await findCandidateByToken(token);
  const state = candidate ? await loadRunnerState(candidate.id) : null;

  if (!state) {
    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
        <h1 className="text-lg font-bold text-[#231a28]">Tautan tes tidak ditemukan</h1>
        <p className="mt-1 text-sm text-[#6a5f72]">Periksa kembali tautan yang Anda buka, atau lamar ulang dari halaman lowongan.</p>
      </div>
    );
  }
  // Tes Situasi Kerja opens after the first (gate) test. It is separate from the tests above and never changes the applicant's status.
  const assessment = candidate ? await assessmentEntryState(candidate.id) : "none";
  return (
    <div className="space-y-4">
      <TestRunner access={{ token }} state={state} serverNowMs={new Date().getTime()} />
      {assessment !== "none" && !state.active && (
        <div className="rounded-xl border border-[#e6dcea] bg-white p-5">
          <h2 className="text-base font-bold text-[#231a28]">{t("assessment.name")}</h2>
          {assessment === "done" ? (
            <p className="mt-1 text-sm text-[#6a5f72]">{t("assessment.candidate.doneTitle")}. Jawaban Anda sudah kami terima.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-[#6a5f72]">20 situasi kerja dengan empat pilihan jawaban. Tidak ada batas waktu dan tidak ada jawaban benar atau salah.</p>
              <Link href={`/cbp-recruitment/asesmen/${token}`} className="mt-3 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-dark">
                {assessment === "in-progress" ? "Lanjutkan" : t("assessment.candidate.start")}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
