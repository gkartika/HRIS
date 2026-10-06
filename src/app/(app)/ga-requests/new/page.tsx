import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { canSubmitGaRequest } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { NewGaRequestForm } from "./new-request-form";

export default async function NewGaRequestPage() {
  const session = await requireSession();
  if (!canSubmitGaRequest(session)) {
    return <AccessDenied />;
  }

  const [assets, locations] = await Promise.all([
    prisma.fixedAsset.findMany({
      where: { activeFlag: true },
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, assetName: true },
    }),
    prisma.assetLocation.findMany({ where: { activeFlag: true }, orderBy: { locationName: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Buat Permintaan GA Operations</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ajukan kebutuhan aset baru, laporkan kerusakan/kondisi tidak normal, atau laporkan kehilangan aset.
      </p>
      <div className="mt-4">
        <NewGaRequestForm
          assets={assets.map((a) => ({ id: a.id, label: `${a.assetCode} — ${a.assetName}` }))}
          locations={locations.map((l) => ({ id: l.id, label: l.locationName }))}
        />
      </div>
    </div>
  );
}
