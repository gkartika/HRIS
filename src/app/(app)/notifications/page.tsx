import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { DEFAULT_PREFS, prefsFromAccount } from "@/lib/notification-prefs";
import { NotificationForm } from "./notification-form";

export default async function NotificationsPage() {
  const session = await requireSession();
  const account = await prisma.account.findUnique({
    where: { id: session.user.id },
    select: { notifyIconBadge: true, notifyMenuBadge: true, notifyTabTitle: true },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Notifikasi Persetujuan</h1>
      <p className="mt-1 mb-5 text-sm text-slate-500">
        Penanda angka untuk persetujuan yang belum Anda selesaikan. Angkanya tetap ada selama masih ada yang menunggu, dan hilang saat semuanya sudah diputuskan.
        Pengaturan ini hanya berlaku untuk akun Anda.
      </p>
      <NotificationForm initial={account ? prefsFromAccount(account) : DEFAULT_PREFS} />
    </div>
  );
}
