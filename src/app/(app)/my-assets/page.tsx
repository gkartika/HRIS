import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

const CUSTODY_STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-slate-100 text-slate-500",
};

export default async function MyAssetsPage() {
  const session = await requireSession();
  if (!session.user.employeeId) {
    return <AccessDenied />;
  }

  const custodies = await prisma.assetCustody.findMany({
    where: { employeeId: session.user.employeeId },
    orderBy: { assignedAt: "desc" },
    include: { asset: true },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("asset.myAssetsTitle")}</h1>

      {custodies.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t("asset.myAssetsEmpty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {custodies.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{c.asset.assetName}</p>
                  <p className="font-mono text-xs text-slate-500">{c.asset.assetCode}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Diserahkan {c.assignedAt.toISOString().slice(0, 10)}
                    {c.conditionAtHandover ? ` · Kondisi: ${c.conditionAtHandover}` : ""}
                  </p>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${CUSTODY_STATUS_TONE[c.status]}`}>
                  {t(`assetCustodyStatus.${c.status}`)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
