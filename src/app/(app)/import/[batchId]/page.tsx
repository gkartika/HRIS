import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canAccessImport, canManageConsumables } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { commitImportBatch } from "../actions";
import { DATASET_REGISTRY, isDatasetKey } from "@/lib/import-export/registry";

export default async function ImportBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const session = await requireSession();
  if (!canAccessImport(session)) {
    return <AccessDenied />;
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) notFound();
  // A consumables batch holds employee names and what each took — GA Admin
  // only, even for the other admins who may open the import hub.
  if (batch.importType.startsWith("consumable-") && !canManageConsumables(session)) {
    return <AccessDenied />;
  }

  const mod = isDatasetKey(batch.importType) ? DATASET_REGISTRY[batch.importType] : null;
  const previewColumns = mod ? mod.templateHeaders.slice(0, 3) : [];
  const commitWithId = commitImportBatch.bind(null, batchId);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("importUi.previewTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {mod?.label ?? batch.importType} — {batch.sourceFileName} —{" "}
        {t("importUi.summary", {
          valid: batch.validRows,
          rejected: batch.errorRows,
          total: batch.totalRows,
        })}
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("importUi.rowNumber")}</th>
              {previewColumns.map((col) => (
                <th key={col} className="px-4 py-3 font-medium">
                  {col}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">{t("importUi.status")}</th>
              <th className="px-4 py-3 font-medium">{t("importUi.reason")}</th>
            </tr>
          </thead>
          <tbody>
            {batch.rows.map((row) => {
              const raw = JSON.parse(row.rawData) as Record<string, string>;
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500">{row.rowNumber}</td>
                  {previewColumns.map((col) => (
                    <td key={col} className="px-4 py-3 font-mono text-xs">
                      {raw[col] || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${
                        row.isValid
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {row.isValid
                        ? row.rowAction === "UPDATE"
                          ? "Diperbarui"
                          : row.createdRecordId
                            ? "Dibuat"
                            : t("importUi.statusValid")
                        : t("importUi.statusRejected")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.rejectionReason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {batch.importStatus === "POSTED" ? (
          <p className="text-sm font-medium text-emerald-700">{t("importUi.commitSuccess")}</p>
        ) : (
          <form action={commitWithId}>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {t("importUi.commitButton")} ({batch.validRows})
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
