import { AccessDenied } from "@/components/access-denied";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { formatDateTimeMedium } from "@/lib/format";
import { canManageAccountAccess } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { SettingsTabs } from "../settings-tabs";
import { AccountRowControls, AddRecruitmentAdminForm } from "./account-controls";

const STATUS: Record<string, { label: string; tone: string }> = {
  INVITED: { label: "Undangan terkirim", tone: "bg-amber-50 text-amber-700" },
  ACTIVE: { label: "Aktif", tone: "bg-emerald-50 text-emerald-700" },
  LOCKED: { label: "Terkunci", tone: "bg-amber-50 text-amber-700" },
  DISABLED: { label: "Ditahan", tone: "bg-rose-50 text-rose-700" },
};

export default async function RecruitmentAdminsPage() {
  const session = await requireSession();
  if (!canManageAccountAccess(session)) return <AccessDenied />;

  const accounts = await prisma.account.findMany({
    where: { accountType: "ADMIN", employeeId: null, roles: { some: { role: "RECRUITMENT_ADMIN" } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, usernameOrEmail: true, accountStatus: true, lastLoginAt: true, createdAt: true },
  });

  return (
    <div>
      <SettingsTabs groupId="akun-rekrutmen" current="/admin/recruitment-admins" />
      <h1 className="text-lg font-medium text-slate-900">Akun Admin Rekrutmen</h1>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-slate-500">
        Login terpisah, seperti login Admin SDM, untuk orang yang menjalankan proses pelamar. Akun ini hanya membuka menu Pelamar, tes dan soal, interview, offering letter, lowongan, dan
        memindahkan karyawan untuk lowongan internal. Data karyawan dan menu lain tidak terbuka.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Tambah akun</h2>
        <p className="mt-0.5 mb-3 text-xs text-slate-500">Orang itu menerima email berisi tautan untuk membuat kata sandinya sendiri.</p>
        <AddRecruitmentAdminForm />
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Akun yang ada ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Belum ada akun Admin Rekrutmen.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {accounts.map((a) => {
              const s = STATUS[a.accountStatus] ?? STATUS.INVITED;
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{a.usernameOrEmail}</p>
                    <p className="text-xs text-slate-500">
                      Masuk terakhir: {a.lastLoginAt ? formatDateTimeMedium(a.lastLoginAt) : "belum pernah"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusChip tone={s.tone}>{s.label}</StatusChip>
                    <AccountRowControls accountId={a.id} status={a.accountStatus} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
