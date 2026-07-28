import { requireSession } from "@/lib/require-session";
import { canAccessAuditLog } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

export default async function AuditLogPage() {
  const session = await requireSession();
  if (!canAccessAuditLog(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const events = await prisma.auditLog.findMany({
    orderBy: { eventAt: "desc" },
    take: 100,
    include: { actorAccount: true },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("auditUi.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("auditUi.subtitle")}</p>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t("auditUi.empty")}</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("auditUi.time")}</th>
                <th className="px-4 py-3 font-medium">{t("auditUi.actor")}</th>
                <th className="px-4 py-3 font-medium">{t("auditUi.action")}</th>
                <th className="px-4 py-3 font-medium">{t("auditUi.dataset")}</th>
                <th className="px-4 py-3 font-medium">Alasan</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "medium",
                    }).format(e.eventAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.actorAccount?.usernameOrEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {t(`auditAction.${e.action}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.datasetName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{e.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
