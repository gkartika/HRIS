import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { SettingsTabs } from "../settings-tabs";
import { LevelManager } from "./level-manager";

export default async function EducationLevelsPage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <AccessDenied />;
  }

  const levels = await prisma.educationLevel.findMany({
    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, activeFlag: true },
  });

  return (
    <div>
      <SettingsTabs groupId="karyawan" current="/admin/education-levels" />
      <h1 className="text-lg font-medium text-slate-900">Pendidikan Terakhir</h1>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-slate-500">
        Pilihan dropdown &quot;Pendidikan Terakhir&quot; pada data karyawan. Tambah, ubah, atau urutkan kapan saja.
      </p>
      <LevelManager levels={levels} />
    </div>
  );
}
