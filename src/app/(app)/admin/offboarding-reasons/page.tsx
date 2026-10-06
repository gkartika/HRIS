import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { canManageExitClearanceQuestions } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { SettingsTabs } from "../settings-tabs";
import { ReasonManager } from "./reason-manager";

export default async function OffboardingReasonsPage() {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) {
    return <AccessDenied />;
  }

  const reasons = await prisma.offboardingReasonOption.findMany({
    orderBy: { displayOrder: "asc" },
    select: { id: true, label: true, activeFlag: true },
  });

  return (
    <div>
      <SettingsTabs groupId="offboarding" current="/admin/offboarding-reasons" />
      <h1 className="text-lg font-medium text-slate-900">Alasan Keluar</h1>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-slate-500">
        Pilihan dropdown &quot;Alasan&quot; saat Admin SDM memulai Offboarding. Tambah, ubah, atau urutkan kapan saja.
      </p>
      <ReasonManager reasons={reasons} />
    </div>
  );
}
