import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

const STATUS_LABELS: Record<string, string> = { ASSIGNED: "Berjalan", ATTENDED: "Hadir", COMPLETED: "Selesai", CANCELLED: "Dibatalkan" };
const STATUS_TONE: Record<string, string> = {
  ASSIGNED: "bg-amber-100 text-amber-700",
  ATTENDED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};
const MODE_LABELS: Record<string, string> = { ONLINE: "Daring", IN_PERSON: "Tatap Muka", BLENDED: "Campuran" };

export default async function MyLearningPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requireSession();
  if (!session.user.employeeId) {
    return <AccessDenied />;
  }
  const { status } = await searchParams;

  const assignments = await prisma.learningAssignment.findMany({
    where: {
      employeeId: session.user.employeeId,
      ...(status ? { status: status as "ASSIGNED" | "ATTENDED" | "COMPLETED" | "CANCELLED" } : {}),
    },
    include: { course: { select: { title: true, mode: true, certificateRequired: true } } },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Pembelajaran Saya (My Learning)</h1>
      <p className="mt-1 text-sm text-slate-500">
        Pelatihan yang ditugaskan kepada Anda — dari Permintaan Pelatihan yang disetujui atau Pelatihan Wajib.
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("common.applyFilter")}
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Pelatihan</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                  Belum ada pelatihan yang ditugaskan.
                </td>
              </tr>
            )}
            {assignments.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{a.course.title}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{MODE_LABELS[a.course.mode]}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_TONE[a.status]}`}>{STATUS_LABELS[a.status]}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/training/my-learning/${a.id}`} className="text-xs text-indigo-600 hover:underline">
                    Buka →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
