import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { EmptyState } from "@/components/empty-state";
import { canManageRecruitment } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { ACTIVE_CANDIDATE_STATUSES } from "@/lib/recruitment-candidates";
import { listCandidates, nextStepOf, STAGE_FILTERS, statusesForStage } from "@/lib/recruitment-queries";
import { getRecruitmentSettings, previewPurge } from "@/lib/recruitment-service";
import { formatDateLong } from "@/lib/format";
import { CandidateTable } from "../candidate-table";
import { PurgeButton } from "../candidate-forms";
import type { Prisma } from "@/generated/prisma/client";

const CAP = 400;

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; stage?: string; q?: string }>;
}) {
  const session = await requireSession();
  if (!canManageRecruitment(session)) return <AccessDenied />;

  const { view, stage, q } = await searchParams;
  const query = q?.trim() ?? "";
  const wanted = statusesForStage(stage);
  // The default view is the work list: people waiting for HR Admin.
  const onlyActions = !stage && !query && view !== "all";

  const where: Prisma.RecruitmentCandidateWhereInput = {};
  if (wanted) where.status = { in: wanted };
  else if (onlyActions) where.status = { in: ACTIVE_CANDIDATE_STATUSES };
  if (query) {
    where.AND = query
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({
        OR: [
          { fullName: { contains: word, mode: "insensitive" as const } },
          { email: { contains: word, mode: "insensitive" as const } },
          { request: { requestNumber: { contains: word, mode: "insensitive" as const } } },
          { request: { job: { jobTitle: { contains: word, mode: "insensitive" as const } } } },
        ],
      }));
  }

  const [rowsAll, settings, purge] = await Promise.all([listCandidates(where, CAP), getRecruitmentSettings(), previewPurge()]);
  const rows = onlyActions ? rowsAll.filter((c) => nextStepOf(c).needsAction) : rowsAll;
  const hasFilters = !!(stage || query || view === "all");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-slate-900">Pelamar</h1>
          <p className="mt-1 text-sm text-slate-500">Semua pelamar dari semua permintaan tenaga kerja, eksternal dan internal.</p>
        </div>
        <Link href="/recruitment/settings" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Pengaturan Rekrutmen
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="applicant-search" className="mb-1 block text-xs text-slate-500">
            Cari pelamar
          </label>
          <input id="applicant-search" type="search" name="q" defaultValue={query} placeholder="Nama, email, nomor permintaan, atau jabatan" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Cari
        </button>
        {hasFilters && (
          <Link href="/recruitment/applicants" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Reset
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/recruitment/applicants"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${onlyActions ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
        >
          Perlu tindakan saya
        </Link>
        <Link
          href="/recruitment/applicants?view=all"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!stage && !onlyActions ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
        >
          Semua
        </Link>
        {STAGE_FILTERS.map((s) => (
          <Link
            key={s.key}
            href={`/recruitment/applicants?stage=${s.key}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${stage === s.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState filtered={hasFilters} message={onlyActions ? "Tidak ada pelamar yang menunggu tindakan Anda." : "Belum ada pelamar."} resetHref="/recruitment/applicants" />
      ) : (
        <CandidateTable rows={rows} showRequest />
      )}
      {rowsAll.length >= CAP && <p className="text-xs text-slate-400">Menampilkan {CAP} pelamar terbaru. Persempit dengan pencarian atau filter tahap.</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Bersihkan data pelamar lama</h2>
        <p className="mt-1 text-xs text-slate-500">
          Pelamar yang tidak lolos, ditolak, menolak offering, atau tidak terpilih disimpan {settings.retentionDays} hari. Setelah itu data, jawaban tes, penilaian, dan CV-nya bisa dihapus permanen. Pelamar yang menjadi karyawan tidak pernah dihapus.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          {purge.count === 0
            ? "Tidak ada pelamar yang sudah melewati masa simpan."
            : `${purge.count} pelamar (${purge.withCv} dengan CV) sudah lewat ${formatDateLong(purge.cutoff)}.`}
        </p>
        {purge.sample.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
            {purge.sample.map((s, i) => (
              <li key={i}>
                {s.fullName}, selesai {formatDateLong(s.closedAt)}
              </li>
            ))}
            {purge.count > purge.sample.length && <li>dan {purge.count - purge.sample.length} lainnya</li>}
          </ul>
        )}
        <div className="mt-3">
          <PurgeButton count={purge.count} />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Penghapusan tidak bisa dibatalkan. Masa simpan diatur di Pengaturan Rekrutmen.</p>
      </div>
    </div>
  );
}
