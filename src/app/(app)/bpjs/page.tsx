import { AccessDenied } from "@/components/access-denied";
import { prisma } from "@/lib/db";
import { companyToday } from "@/lib/company-time";
import { formatDateMedium } from "@/lib/format";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { dayText, MONTHLY_LIST_FROM_DAY, monthKey, monthlyListDeadline, monthName, parseMonthKey } from "@/lib/bpjs-reminders";
import { getMissingStartDates, getMonthlyList, getRecentMarks } from "@/lib/bpjs-queries";
import { MarkDoneButton, PrintButton, StartDatesForm, UndoButton } from "./bpjs-client";

// BPJS for Admin SDM: the monthly list of harian lepas and magang (for the BPJS TK registration), the start dates that
// are still missing, and the latest "Sudah" marks. The reminders themselves are on the Beranda.
export default async function BpjsPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const session = await requireSession();
  if (!isHrAdmin(session)) return <AccessDenied />;

  const { bulan } = await searchParams;
  const today = companyToday();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const defaultMonth = today.getUTCDate() >= MONTHLY_LIST_FROM_DAY ? monthKey(y, m + 1) : monthKey(y, m);
  const options = [-1, 0, 1, 2].map((delta) => {
    const d = new Date(Date.UTC(y, m + delta, 1));
    return { key: monthKey(d.getUTCFullYear(), d.getUTCMonth()), label: `${monthName(d.getUTCMonth())} ${d.getUTCFullYear()}` };
  });
  const chosen = parseMonthKey(bulan ?? "") && options.some((o) => o.key === bulan) ? (bulan as string) : defaultMonth;
  const parsed = parseMonthKey(chosen)!;
  const listKey = `MONTHLY_LIST:${chosen}`;

  const [list, missing, marks, doneRow] = await Promise.all([
    getMonthlyList(parsed.year, parsed.monthIndex),
    getMissingStartDates(),
    getRecentMarks(),
    prisma.bpjsTaskDone.findUnique({ where: { taskKey: listKey }, select: { markedAt: true } }),
  ]);
  const deadline = monthlyListDeadline(parsed.year, parsed.monthIndex);
  const title = `${monthName(parsed.monthIndex)} ${parsed.year}`;
  const th = "px-3 py-2";

  return (
    <div className="space-y-8">
      <div className="print:hidden">
        <h1 className="text-lg font-medium text-slate-900">BPJS</h1>
        <p className="mt-1 text-sm text-slate-500">Pengingat pendaftaran, penonaktifan dan pembayaran ada di Beranda. Di sini: daftar bulanan, tanggal masuk yang belum diisi, dan riwayat tanda Sudah.</p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Daftar BPJS TK harian lepas dan magang</h2>
            <p className="text-sm text-slate-500">Semua yang aktif pada 1 {monthName(parsed.monthIndex)}; yang keluar sebelum tanggal itu tidak ikut. Batas mendaftarkan: {dayText(deadline)}.</p>
          </div>
          <form method="get" className="flex items-end gap-2">
            <label className="text-xs text-slate-600">
              Bulan
              <select name="bulan" defaultValue={chosen} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
                {options.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Tampilkan</button>
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
            <p className="text-sm font-semibold text-slate-700">Daftar BPJS TK {title} · {list.length} orang</p>
            <div className="flex gap-2 print:hidden">
              <a href={`/api/bpjs/monthly-list?bulan=${chosen}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Unduh Excel</a>
              <PrintButton />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-xs text-slate-500">
                <tr>
                  <th className={th}>No</th><th className={th}>Nama</th><th className={th}>Status</th><th className={th}>Bagian</th><th className={th}>NIK</th><th className={th}>Tgl lahir</th><th className={th}>No. BPJS TK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r, i) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-900">{r.name}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.status}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.section}</td>
                    <td className="px-3 py-1.5 tabular-nums text-slate-600">{r.nik ?? <span className="text-amber-700">belum diisi</span>}</td>
                    <td className="px-3 py-1.5 text-slate-600">{formatDateMedium(r.birthDate)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.bpjsTkNumber ?? <span className="text-slate-400">belum ada</span>}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">Tidak ada harian lepas atau magang yang aktif.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 print:hidden">
            <p className="text-xs text-slate-500">Setelah daftar ini dikirim ke BPJS TK, tekan tombol di kanan. Pengingat di Beranda hilang.</p>
            {doneRow ? (
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Sudah didaftarkan {formatDateMedium(doneRow.markedAt)}</span>
                <UndoButton taskKey={listKey} />
              </div>
            ) : (
              <MarkDoneButton taskKey={listKey} label="Sudah didaftarkan semua" />
            )}
          </div>
        </div>
      </section>

      <section id="tanggal-masuk" className="space-y-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Tanggal masuk yang belum diisi</h2>
          <p className="text-sm text-slate-500">Batas 7 hari mendaftarkan BPJS TK dihitung dari tanggal masuk. Yang masuk sebelum 1 Nov 2026 tidak akan muncul sebagai pengingat, jadi isi saja tanggal aslinya atau perkiraan.</p>
        </div>
        {missing.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">Semua harian lepas dan magang aktif sudah punya tanggal masuk.</p>
        ) : (
          <StartDatesForm rows={missing} />
        )}
      </section>

      <section className="space-y-3 print:hidden">
        <h2 className="text-base font-semibold text-slate-900">Terakhir ditandai Sudah</h2>
        {marks.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {marks.map((mk) => (
              <div key={mk.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <div>
                  <p className="text-sm text-slate-900">{mk.text}</p>
                  <p className="text-xs text-slate-500">{formatDateMedium(mk.markedAt)} · {mk.by}</p>
                </div>
                <UndoButton taskKey={mk.key} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
