import { requireSession } from "@/lib/require-session";
import { canAccessAuditLog } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import Link from "next/link";
import type { Prisma, AuditAction } from "@/generated/prisma/client";

const AUDIT_ACTIONS: AuditAction[] = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "APPROVE",
  "REJECT",
  "IMPORT",
  "EXPORT",
  "PRINT",
  "RELEASE",
  "DELETE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
];

const PAGE_SIZE = 100;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; datasetName?: string; actor?: string; from?: string; to?: string }>;
}) {
  const session = await requireSession();
  if (!canAccessAuditLog(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const { action, datasetName, actor, from, to } = await searchParams;

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = action as AuditAction;
  if (datasetName) where.datasetName = datasetName;
  if (actor?.trim()) {
    where.actorAccount = { usernameOrEmail: { contains: actor.trim(), mode: "insensitive" } };
  }
  if (from || to) {
    where.eventAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
    };
  }

  const [events, totalCount, datasetNames] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { eventAt: "desc" },
      take: PAGE_SIZE,
      include: { actorAccount: true },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["datasetName"],
      select: { datasetName: true },
      orderBy: { datasetName: "asc" },
    }),
  ]);

  const hasFilters = !!(action || datasetName || actor || from || to);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("auditUi.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("auditUi.subtitle")}</p>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("auditUi.action")}</label>
          <select name="action" defaultValue={action ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`auditAction.${a}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("auditUi.dataset")}</label>
          <select
            name="datasetName"
            defaultValue={datasetName ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{t("common.allOption")}</option>
            {datasetNames.map((d) => (
              <option key={d.datasetName} value={d.datasetName}>
                {d.datasetName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("auditUi.actor")}</label>
          <input
            type="text"
            name="actor"
            defaultValue={actor ?? ""}
            placeholder="email@cbp.demo"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Dari Tanggal</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Sampai Tanggal</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/audit-log" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      <p className="mt-3 text-xs text-slate-400">
        {t("common.filteredCount", { shown: events.length, total: totalCount })}
        {totalCount > PAGE_SIZE && !hasFilters && " — persempit dengan filter untuk melihat data lebih lama."}
      </p>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          {hasFilters ? t("common.noFilteredResults") : t("auditUi.empty")}
        </p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
