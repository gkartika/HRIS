import { AccessDenied } from "@/components/access-denied";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { formatDateTimeMedium } from "@/lib/format";
import { PERFORMANCE_SCALE, TATA_NILAI_SCALE } from "@/lib/evaluation";
import { SettingsTabs } from "../settings-tabs";
import { CriteriaSectionManager, type CriterionRow } from "./criteria-manager";
import { GuidelineCard, type GuidelineInfo } from "./guideline-card";

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// What an evaluator sees of a section, using the criteria as they are now (switched-off ones left out).
function Preview({ title, rows, scale }: { title: string; rows: CriterionRow[]; scale: readonly number[] }) {
  const active = rows.filter((r) => r.active);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 divide-y divide-slate-100">
        {active.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className="min-w-0 flex-1 text-sm text-slate-800">{r.label}</span>
            <span className="flex gap-1" aria-hidden="true">
              {scale.map((n) => (
                <span key={n} className="grid h-7 min-w-9 place-items-center rounded-md border border-slate-300 px-1.5 text-xs font-semibold text-slate-500">
                  {n}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function EvaluationSettingsPage() {
  const session = await requireSession();
  if (!isHrAdmin(session)) return <AccessDenied />;

  const [criteria, setting] = await Promise.all([
    prisma.evaluationCriterion.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, section: true, label: true, active: true } }),
    prisma.evaluationSetting.findUnique({
      where: { id: "default" },
      select: { guidelineFile: { select: { originalFileName: true, sizeBytes: true, createdAt: true, uploadedByAccount: { select: { usernameOrEmail: true } } } } },
    }),
  ]);
  const rowsOf = (section: "PERFORMANCE" | "TATA_NILAI"): CriterionRow[] => criteria.filter((c) => c.section === section).map(({ id, label, active }) => ({ id, label, active }));
  const performance = rowsOf("PERFORMANCE");
  const tataNilai = rowsOf("TATA_NILAI");

  const file = setting?.guidelineFile;
  const guideline: GuidelineInfo | null = file
    ? { fileName: file.originalFileName, sizeLabel: sizeLabel(file.sizeBytes), uploadedLabel: `diunggah ${formatDateTimeMedium(file.createdAt)} oleh ${file.uploadedByAccount.usernameOrEmail}` }
    : null;

  return (
    <div>
      <SettingsTabs groupId="evaluasi" current="/admin/evaluation-settings" />
      <h1 className="text-lg font-medium text-slate-900">Pengaturan Evaluasi</h1>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-slate-500">Atur pedoman dan kriteria penilaian kinerja (FR-HC-01-07) yang dipakai evaluator.</p>

      <div className="space-y-5">
        <GuidelineCard guideline={guideline} />

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <b>Berlaku untuk evaluasi berikutnya.</b> Perubahan di bawah tersimpan langsung, tetapi hanya dipakai evaluasi yang dirilis sesudahnya. Evaluasi yang sudah dirilis tetap memakai
          kriteria saat dirilis, supaya nilai yang sudah masuk tidak berubah artinya. Kriteria yang dinonaktifkan tidak muncul di evaluasi baru; kriteria tidak dihapus.
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <CriteriaSectionManager
            section="PERFORMANCE"
            title="Bagian 1 — Performance"
            rulesText={`Nilai tetap: ${PERFORMANCE_SCALE.join(", ")}. Hasil ditampilkan sebagai total dan persen dari nilai tertinggi.`}
            rows={performance}
          />
          <CriteriaSectionManager
            section="TATA_NILAI"
            title="Bagian 2 — Tata Nilai"
            rulesText={`Nilai tetap: ${TATA_NILAI_SCALE.join(", ")}. Hasil ditampilkan sebagai rata-rata.`}
            rows={tataNilai}
          />
        </div>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Pratinjau untuk evaluator</h2>
          <p className="mt-0.5 mb-3 text-xs text-slate-500">Begini kriteria akan tampil di evaluasi yang dirilis sekarang.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            <Preview title="Bagian 1 — Performance" rows={performance} scale={PERFORMANCE_SCALE} />
            <Preview title="Bagian 2 — Tata Nilai" rows={tataNilai} scale={TATA_NILAI_SCALE} />
          </div>
        </section>
      </div>
    </div>
  );
}
