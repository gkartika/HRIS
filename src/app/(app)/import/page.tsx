import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canAccessImport } from "@/lib/permissions";
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
];

export default async function ImportPage() {
  const session = await requireSession();
  if (!canAccessImport(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const batches = await prisma.importBatch.findMany({
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
        {DATASET_ORDER.map((key) => (
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
                    {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
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
