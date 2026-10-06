import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { SettingsTabs } from "../settings-tabs";
import { StatusManager } from "./status-manager";

export default async function PtkpStatusPage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <AccessDenied />;
  }

  const statuses = await prisma.ptkpStatus.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, label: true, activeFlag: true },
  });

  return (
    <div>
      <SettingsTabs groupId="karyawan" current="/admin/ptkp-status" />
      <h1 className="text-lg font-medium text-slate-900">PTKP Pajak</h1>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-slate-500">
        Pilihan dropdown &quot;PTKP Pajak&quot; pada data karyawan. Tambah kode baru, ubah label, atau urutkan kapan saja.
      </p>
      <StatusManager statuses={statuses} />
    </div>
  );
}
