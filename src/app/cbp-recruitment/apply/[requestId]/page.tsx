import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadPlanContext, possibleTests, readinessProblems } from "@/lib/recruitment-service";
import { describeTestSteps } from "@/lib/recruitment-candidates";
import { t } from "@/lib/i18n/id";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";

export default async function ApplyPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const [request, ctx] = await Promise.all([
    prisma.recruitmentRequest.findUnique({
      where: { id: requestId },
      include: { job: true, department: true, _count: { select: { fulfillments: true } } },
    }),
    loadPlanContext(),
  ]);

  const open =
    request &&
    request.jobId &&
    (request.openFor === "EXTERNAL" || request.openFor === "BOTH") &&
    readinessProblems(ctx, request, request._count.fulfillments).length === 0;

  if (!open || !request.jobId) {
    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
        <h1 className="text-lg font-bold text-[#231a28]">{request?.heldAt ? "Lowongan dihentikan sementara" : "Lowongan tidak tersedia"}</h1>
        <p className="mt-1 text-sm text-[#6a5f72]">
          {request?.heldAt ? "Lowongan ini sedang dihentikan sementara. Silakan cek lagi nanti." : "Lowongan ini sudah ditutup atau belum dibuka."}
        </p>
        <Link href="/cbp-recruitment" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
          Lihat lowongan lain
        </Link>
      </div>
    );
  }

  const steps = describeTestSteps(possibleTests(ctx, request));

  return (
    <div>
      <Link href="/cbp-recruitment" className="text-sm font-semibold text-brand hover:underline">
        ← Semua lowongan
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-[#231a28]">{request.job?.jobTitle}</h1>
      <p className="text-sm text-[#6a5f72]">
        {request.department.unitName} · {t(`shiftCode.${request.shiftCode}`)}
      </p>

      <div className="mt-5 rounded-xl border border-[#e6dcea] bg-white p-5">
        <h2 className="text-base font-bold text-[#231a28]">Sebelum melamar</h2>
        <p className="mt-1 text-sm text-[#4a3e52]">
          Setelah mengisi data, Anda langsung mengerjakan tes secara online:{" "}
          {steps.map((s, i) => (
            <span key={s.label}>
              {i > 0 && ", "}
              <b>{s.label}</b> ({s.timeLimitMinutes} menit)
            </span>
          ))}
          . Waktu berjalan begitu tes dimulai dan tidak bisa dihentikan. Salin dan tempel dinonaktifkan. Siapkan sekitar{" "}
          {steps.reduce((sum, s) => sum + s.timeLimitMinutes, 0)} menit tanpa gangguan.
        </p>
      </div>

      <div className="mt-5">
        <ApplyForm requestId={request.id} />
      </div>
    </div>
  );
}
