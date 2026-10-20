import { findCandidateByToken, loadRunnerState } from "@/lib/recruitment-service";
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
  return <TestRunner access={{ token }} state={state} serverNowMs={new Date().getTime()} />;
}
