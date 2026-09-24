import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import {
  canAccessImport,
  canImportMandatoryTrainingParticipants,
  canImportTrainingAttendance,
  canImportAssetMaster,
} from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { UploadForm } from "./upload-form";
import { EmployeeDocumentsZipForm } from "./employee-documents-zip-form";
import { DATASET_REGISTRY, isDatasetKey, type DatasetKey } from "@/lib/import-export/registry";
import { isHrAdmin } from "@/lib/permissions";

const DATASET_ORDER: DatasetKey[] = [
  "employees",
  "org-units",
  "jobs",
  "positions",
  "assignments",
  "fingerprint-attendance",
  "competency-migration",
  "mandatory-training-participants",
  "training-attendance",
  "asset-master",
];

// The 7 HR-domain datasets above are all HR-Admin-only (every existing
// canAccessDataset/canImportDataset branch for them resolves to
// isHrAdmin); the two Phase 3B Training datasets admit Training Admin too,
// and Phase 4A's asset-master is GA-Admin-only (never HR Admin, per the
// access boundary — see feedback_widening_access_gates memory: canAccessImport
// widens the whole hub page to Training/GA Admin, so this filter keeps
// either from seeing upload forms they can't actually submit).
const TRAINING_DATASETS: DatasetKey[] = ["mandatory-training-participants", "training-attendance"];
const GA_DATASETS: DatasetKey[] = ["asset-master"];

export default async function ImportPage() {
  const session = await requireSession();
  if (!canAccessImport(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const visibleDatasets = DATASET_ORDER.filter((key) => {
    if (TRAINING_DATASETS.includes(key)) return canImportMandatoryTrainingParticipants(session) || canImportTrainingAttendance(session);
    if (GA_DATASETS.includes(key)) return canImportAssetMaster(session);
    return isHrAdmin(session);
  });

  const batches = await prisma.importBatch.findMany({
    where: isHrAdmin(session) ? {} : { importType: { in: visibleDatasets } },
    orderBy: { uploadedAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("importUi.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Unduh contoh berkas CSV, unggah untuk pratinjau, atau ekspor data saat ini — untuk setiap
        dataset di bawah ini (CTL-13).
      </p>

      <div className="mt-4 space-y-3">
        {visibleDatasets.map((key) => (
          <UploadForm key={key} dataset={key} label={DATASET_REGISTRY[key].label} />
        ))}
        {isHrAdmin(session) && <EmployeeDocumentsZipForm />}
      </div>

      <h2 className="mt-8 text-sm font-medium text-slate-900">{t("importUi.batchHistory")}</h2>
      {batches.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{t("importUi.noBatches")}</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Dataset</th>
                <th className="px-4 py-3 font-medium">Berkas</th>
                <th className="px-4 py-3 font-medium">Diunggah</th>
                <th className="px-4 py-3 font-medium">Ringkasan</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">
                    {isDatasetKey(b.importType) ? DATASET_REGISTRY[b.importType].label : b.importType}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/import/${b.id}`} className="text-indigo-600 hover:underline">
                      {b.sourceFileName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(
                      b.uploadedAt
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t("importUi.summary", {
                      valid: b.validRows,
                      rejected: b.errorRows,
                      total: b.totalRows,
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.importStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
