import Link from "next/link";
import { getRecruitmentHomeData, type RecruitmentHomeData } from "@/lib/recruitment-home-queries";
import { REC_FILTERS, REC_GROUPS, type RecKind } from "@/lib/recruitment-home";
import type { Severity } from "@/lib/ga-home";

const STRIPE: Record<Severity, string> = { rose: "bg-rose-500", amber: "bg-amber-400", slate: "bg-slate-300" };
const PILL: Record<Severity, string> = {
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-800",
  slate: "bg-slate-100 text-slate-600",
};
const NEXT_TONE: Record<Severity, string> = { rose: "bg-rose-50 text-rose-800", amber: "bg-amber-50 text-amber-900", slate: "bg-slate-50 text-slate-700" };
const STATE_LABEL = { held: "ditahan", unopened: "belum dibuka", open: "dibuka" } as const;
// How many rows of one group show in the "Semua" view; the rest is one click away.
const GROUP_LIMIT = 5;

function filterHref(key: RecKind | "all"): string {
  return key === "all" ? "/dashboard#rec-home" : `/dashboard?rec=${key}#rec-home`;
}

// Beranda for Admin Rekrutmen: what to do now (grouped by kind of work), what is waiting for someone else,
// the interviews of the week and the progress of every vacancy from applicants to seats filled.
export async function RecruitmentAdminHome({ filter }: { filter: RecKind | "all" }) {
  return <RecruitmentHomeView data={await getRecruitmentHomeData()} filter={filter} />;
}

function RecruitmentHomeView({ data, filter }: { data: RecruitmentHomeData; filter: RecKind | "all" }) {
  const { stats, summary } = data;
  const barTotal = Math.max(1, summary.applicants);
  const fillPercent = stats.headcount === 0 ? 0 : Math.round((stats.filled / stats.headcount) * 100);
  const groups = REC_GROUPS.filter((g) => (filter === "all" || filter === g.key) && data.counts[g.key] > 0);

  return (
    <section id="rec-home" className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Beranda Rekrutmen</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {stats.todo === 0 ? "Tidak ada yang menunggu tindakan Anda." : `${stats.todo} hal menunggu tindakan Anda. Perubahan Posisi pelamar internal juga dijalankan dari sini.`}
        </p>
      </div>

      {data.warnings.shown.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {data.warnings.shown.map((w) => (
            <p key={w.text}>
              <b>Perlu dicek:</b> {w.text}{" "}
              <Link href={w.href} className="ml-1 font-medium text-indigo-700 underline">
                {w.actionLabel} →
              </Link>
            </p>
          ))}
          {data.warnings.hidden > 0 && <p className="text-xs text-amber-800">dan {data.warnings.hidden} lainnya. Lihat di Pengaturan Rekrutmen.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Perlu Anda kerjakan</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{stats.todo}</p>
          <p className={`mt-1 text-[11px] ${stats.overdue > 0 ? "text-rose-600" : "text-slate-500"}`}>
            {stats.overdue > 0 ? `${stats.overdue} sudah menunggu 3 hari atau lebih` : "Tidak ada yang menunggu lama"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Interview 7 hari ke depan</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{stats.interviews}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {stats.interviews === 0
              ? "Belum ada yang terjadwal"
              : [stats.interviewsToday > 0 ? `${stats.interviewsToday} hari ini` : null, stats.interviewsTomorrow > 0 ? `${stats.interviewsTomorrow} besok` : null].filter(Boolean).join(", ") || "Mulai lusa"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Menunggu pihak lain</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{stats.waiting}</p>
          <p className="mt-1 text-[11px] text-slate-500">bukan tugas Anda, tapi perlu dipantau</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Posisi terisi (semua lowongan)</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {stats.filled}
            <span className="text-base font-normal text-slate-400"> / {stats.headcount}</span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="presentation">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${fillPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Kerjakan sekarang <span className="font-normal text-slate-400">· dikelompokkan per jenis pekerjaan, yang paling lama menunggu di atas</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {REC_FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={filterHref(f.key)}
                  scroll={false}
                  className={`rounded-full border px-2.5 py-1 ${filter === f.key ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {f.label} <b className="tabular-nums">{data.counts[f.key]}</b>
                </Link>
              ))}
            </div>
            <div className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {groups.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">{filter === "all" ? "Tidak ada yang perlu Anda kerjakan sekarang." : "Tidak ada yang perlu dikerjakan di kategori ini."}</p>
              ) : (
                groups.map((g) => {
                  const rows = data.rows.filter((r) => r.kind === g.key);
                  const shown = filter === "all" ? rows.slice(0, GROUP_LIMIT) : rows;
                  return (
                    <div key={g.key}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 bg-slate-50 px-4 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {g.label} <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium normal-case tabular-nums text-slate-700 ring-1 ring-slate-200">{rows.length}</span>
                        </p>
                        <p className="text-[11px] text-slate-400">{g.hint}</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {shown.map((r) => (
                          <div key={`${r.kind}-${r.href}-${r.type}`} className="flex items-stretch gap-3 px-4 py-3 hover:bg-slate-50">
                            <span className={`w-1 shrink-0 rounded-full ${STRIPE[r.severity]}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium text-slate-500">{r.type}</p>
                              <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                              <p className="text-xs text-slate-500">{r.who}</p>
                            </div>
                            <div className="hidden shrink-0 flex-col items-end justify-center gap-1 text-right sm:flex">
                              <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${PILL[r.severity]}`}>{r.statusLabel}</span>
                              {r.timeLabel && <span className="text-[11px] text-slate-400">{r.timeLabel}</span>}
                            </div>
                            <Link href={r.href} className="shrink-0 self-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                              {r.actionLabel}
                            </Link>
                          </div>
                        ))}
                        {shown.length < rows.length && (
                          <Link href={filterHref(g.key)} scroll={false} className="block px-4 py-2 text-xs font-medium text-indigo-600 hover:bg-slate-50">
                            Tampilkan {rows.length - shown.length} lagi di {g.label} →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                Progres tiap lowongan <span className="font-normal text-slate-400">· yang sedang berjalan sekarang, sampai posisi terisi</span>
              </p>
              <Link href="/recruitment" className="shrink-0 text-xs text-indigo-600 hover:underline">
                Semua permintaan →
              </Link>
            </div>
            {data.vacancies.length === 0 ? (
              <p className="mt-2 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">Belum ada permintaan yang disetujui dan sedang direkrut.</p>
            ) : (
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {data.vacancies.map((v) => {
                  const pct = v.headcount === 0 ? 0 : Math.min(100, Math.round((v.filled / v.headcount) * 100));
                  return (
                    <Link key={v.id} href={`/recruitment/${v.id}`} className={`block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 ${v.state === "held" ? "opacity-70" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{v.jobLabel}</p>
                          <p className="text-[11px] text-slate-400">
                            {v.requestNumber} · {v.department} · {STATE_LABEL[v.state]}
                            {v.approvedDays !== null ? ` · disetujui ${v.approvedDays === 0 ? "hari ini" : `${v.approvedDays} hari lalu`}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-lg font-semibold tabular-nums text-slate-900">
                          {v.filled}
                          <span className="text-sm font-normal text-slate-400"> / {v.headcount} terisi</span>
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="presentation">
                        <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-6 gap-1 text-center">
                        {v.stages.map((s) => (
                          <div key={s.label} className={`rounded-md py-1 ${s.count > 0 ? "bg-indigo-50" : "bg-slate-50"}`}>
                            <p className={`text-base font-semibold tabular-nums ${s.count > 0 ? "text-indigo-700" : "text-slate-300"}`}>{s.count}</p>
                            <p className="text-[10px] text-slate-500">{s.label}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">{v.totalApplicants === 0 ? "Belum ada pelamar yang mendaftar." : `${v.totalApplicants} pelamar mendaftar sejak awal, termasuk yang sudah gugur.`}</p>
                      <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${NEXT_TONE[v.next.severity]}`}>
                        <b>Langkah berikutnya:</b> {v.next.text}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Interview 7 hari ke depan</p>
            {data.upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Belum ada interview yang terjadwal minggu ini.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {data.upcoming.slice(0, 8).map((i) => (
                  <Link key={i.id} href={i.href} className="flex gap-3 rounded-md hover:bg-slate-50">
                    <div className="w-14 shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-900">{i.time}</p>
                      {i.modeLabel && <p className="text-[10px] text-slate-400">{i.modeLabel}</p>}
                    </div>
                    <div className="min-w-0 border-l border-slate-200 pl-3">
                      <p className="text-[11px] text-slate-400">{i.dayLabel}</p>
                      <p className="truncate text-sm font-medium text-slate-900">{i.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{i.jobLabel}</p>
                      <p className={`text-[11px] ${i.needsInterviewer ? "text-amber-700" : "text-emerald-700"}`}>{i.interviewersLabel}</p>
                    </div>
                  </Link>
                ))}
                {data.upcoming.length > 8 && <p className="text-xs text-slate-400">dan {data.upcoming.length - 8} interview lain.</p>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Menunggu pihak lain</p>
            <p className="text-xs text-slate-500">Bukan tugas Anda sekarang. Disorot kalau sudah terlalu lama.</p>
            {data.waiting.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Tidak ada yang sedang ditunggu.</p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100">
                {data.waiting.slice(0, 6).map((w) => (
                  <Link key={`${w.href}-${w.title}`} href={w.href} className="block py-2 hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-900">
                      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${STRIPE[w.severity]}`} />
                      {w.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {w.detail}
                      {w.age > 0 ? ` · ${w.age} hari` : ""}
                    </p>
                  </Link>
                ))}
                {data.waiting.length > 6 && <p className="pt-2 text-xs text-slate-400">dan {data.waiting.length - 6} lainnya.</p>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">30 hari terakhir</p>
              <Link href="/recruitment/dashboard" className="text-xs text-indigo-600 hover:underline">
                Dasbor →
              </Link>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{summary.applicants}</dd>
                <dt className="text-[11px] text-slate-500">Pelamar baru</dt>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{summary.passed}</dd>
                <dt className="text-[11px] text-slate-500">Lolos tes</dt>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{summary.hired}</dd>
                <dt className="text-[11px] text-slate-500">Diterima</dt>
              </div>
            </dl>
            {summary.applicants > 0 && (
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200" role="presentation">
                <div className="bg-brand" style={{ width: `${Math.min(100, (summary.hired / barTotal) * 100)}%` }} />
                <div className="bg-amber-400" style={{ width: `${Math.max(0, Math.min(100, ((summary.passed - summary.hired) / barTotal) * 100))}%` }} />
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              {summary.hiringRate === null ? "Belum ada pelamar dalam 30 hari terakhir." : `Hiring rate ${summary.hiringRate.toLocaleString("id-ID")}%`}
              {summary.avgDaysToHire !== null && ` · rata-rata ${summary.avgDaysToHire.toLocaleString("id-ID")} hari dari melamar sampai diterima`}
              {summary.hiringRate !== null && "."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
