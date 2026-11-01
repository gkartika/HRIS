// The BPJS reminders of the Admin SDM Beranda, as pure rules (no Prisma): when a leaver's BPJS goes off and the report
// deadlines, the 7-day registration of a new harian lepas / magang, the monthly list, and the payment on the 8th.
// The Beranda rows are built here from plain data; "Sudah" marks come in as a set of task keys.
import { DAY_MS, MONTH_LABELS_ID } from "@/lib/company-time";
import type { Severity } from "@/lib/ga-home";
import type { HcTodoRow } from "@/lib/hc-home";

// Tasks whose deadline is before this date are not shown: they belong to the time before these reminders existed.
export const BPJS_REMINDERS_FROM = new Date(Date.UTC(2026, 10, 1));
export const REGISTRATION_DAYS = 7;
export const PAYMENT_DAY = 8;
// The monthly list for next month shows from this day of the month.
export const MONTHLY_LIST_FROM_DAY = 25;

const utc = (year: number, monthIndex: number, day: number) => new Date(Date.UTC(year, monthIndex, day));
const WEEKDAY = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const dayText = (d: Date) => `${d.getUTCDate()} ${MONTH_LABELS_ID[d.getUTCMonth()]}`;
export const dayWithWeekday = (d: Date) => `${WEEKDAY[d.getUTCDay()]} ${dayText(d)}`;
const MONTH_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const monthName = (monthIndex: number) => MONTH_FULL[monthIndex];

export const monthKey = (year: number, monthIndex: number) => {
  const d = utc(year, monthIndex, 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
export function parseMonthKey(key: string): { year: number; monthIndex: number } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
  return m ? { year: Number(m[1]), monthIndex: Number(m[2]) - 1 } : null;
}

export const BPJS_TASK_KEY = /^(?:(?:REGISTER_NEW|DEACTIVATE_KES|DEACTIVATE_TK):[A-Za-z0-9]{8,40}|(?:MONTHLY_LIST|PAY_KES|PAY_TK):\d{4}-(?:0[1-9]|1[0-2]))$/;
export const taskKind = (key: string) => key.slice(0, key.indexOf(":"));

// BPJS goes off on the first day of a month that falls on or after the last working day. Kesehatan must be reported by
// the 18th of the month before that, Ketenagakerjaan by the 5th of the month it goes off.
export function deactivationDates(lastWorkingDay: Date): { offDate: Date; kesDeadline: Date; tkDeadline: Date } {
  const y = lastWorkingDay.getUTCFullYear();
  const m = lastWorkingDay.getUTCMonth();
  const offDate = lastWorkingDay.getUTCDate() === 1 ? utc(y, m, 1) : utc(y, m + 1, 1);
  return {
    offDate,
    kesDeadline: utc(offDate.getUTCFullYear(), offDate.getUTCMonth() - 1, 18),
    tkDeadline: utc(offDate.getUTCFullYear(), offDate.getUTCMonth(), 5),
  };
}

export const registrationDeadline = (startDate: Date) => new Date(startDate.getTime() + REGISTRATION_DAYS * DAY_MS);

// The monthly list for a month must be done before that month starts: by the last day of the month before.
export const monthlyListDeadline = (year: number, monthIndex: number) => utc(year, monthIndex, 0);

export const daysLeft = (deadline: Date, today: Date) => Math.round((deadline.getTime() - today.getTime()) / DAY_MS);

// Grey while far off, amber from 3 days before, red once the deadline has passed.
export function bpjsSeverity(left: number): Severity {
  if (left < 0) return "rose";
  if (left <= 3) return "amber";
  return "slate";
}

export function leftText(left: number): string {
  if (left < 0) return `terlambat ${Math.abs(left)} hari`;
  if (left === 0) return "hari ini";
  if (left === 1) return "besok";
  if (left <= 7) return `sisa ${left} hari`;
  return `${left} hari lagi`;
}

export interface BpjsNewcomer {
  id: string;
  name: string;
  /** Employment status label, for example "Harian lepas". */
  status: string;
  startDate: Date;
}
export interface BpjsLeaver {
  caseId: string;
  name: string;
  status: string;
  lastWorkingDay: Date;
}
export interface BpjsInput {
  today: Date;
  newcomers: BpjsNewcomer[];
  /** Active harian lepas / magang with no start date at all. */
  missingStartDate: number;
  leavers: BpjsLeaver[];
  /** Active harian lepas + magang, for the monthly list row. */
  activeListSize: number;
  done: ReadonlySet<string>;
}

function row(key: string | null, p: { type: string; title: string; who: string; left: number; actionLabel: string; href: string }): HcTodoRow {
  return {
    kind: "bp",
    type: p.type,
    title: p.title,
    who: p.who,
    statusLabel: leftText(p.left).replace(/^./, (c) => c.toUpperCase()),
    severity: bpjsSeverity(p.left),
    urgency: 100 - p.left,
    timeLabel: "",
    actionLabel: p.actionLabel,
    href: p.href,
    ...(key ? { bpjsTaskKey: key } : {}),
  };
}

export function buildBpjsRows(input: BpjsInput): HcTodoRow[] {
  const { today, done } = input;
  const rows: HcTodoRow[] = [];
  const visible = (deadline: Date) => deadline.getTime() >= BPJS_REMINDERS_FROM.getTime();

  // ---- registration of new harian lepas / magang: 7 days after the start ----
  for (const n of input.newcomers) {
    const key = `REGISTER_NEW:${n.id}`;
    const deadline = registrationDeadline(n.startDate);
    if (done.has(key) || !visible(deadline) || n.startDate.getTime() > today.getTime()) continue;
    rows.push(
      row(key, {
        type: "Daftar BPJS TK · karyawan baru",
        title: `${n.name} (${n.status}, masuk ${dayText(n.startDate)})`,
        who: `Belum didaftarkan. Batas ${REGISTRATION_DAYS} hari setelah masuk: ${dayText(deadline)}.`,
        left: daysLeft(deadline, today),
        actionLabel: "Sudah didaftarkan",
        href: "/bpjs",
      })
    );
  }
  if (input.missingStartDate > 0) {
    rows.push({
      kind: "bp",
      type: "Daftar BPJS TK · data",
      title: `${input.missingStartDate} harian lepas dan magang belum ada tanggal masuk`,
      who: "Isi tanggal masuknya supaya batas 7 hari bisa dihitung.",
      statusLabel: "Data belum lengkap",
      severity: "slate",
      urgency: 0,
      timeLabel: "",
      actionLabel: "Lengkapi",
      href: "/bpjs#tanggal-masuk",
    });
  }

  // ---- leavers: deactivate Kesehatan and Ketenagakerjaan ----
  for (const l of input.leavers) {
    const { offDate, kesDeadline, tkDeadline } = deactivationDates(l.lastWorkingDay);
    const who = (deadline: Date) => `BPJS mati otomatis ${dayText(offDate)} jika dilaporkan tepat waktu. Batas lapor ${dayText(deadline)}.`;
    const title = `${l.name} (${l.status}, hari terakhir ${dayText(l.lastWorkingDay)})`;
    for (const [prefix, label, deadline] of [
      ["DEACTIVATE_KES", "Kesehatan", kesDeadline],
      ["DEACTIVATE_TK", "Ketenagakerjaan", tkDeadline],
    ] as const) {
      const key = `${prefix}:${l.caseId}`;
      if (done.has(key) || !visible(deadline)) continue;
      rows.push(row(key, { type: `Nonaktifkan BPJS ${label} · karyawan keluar`, title, who: who(deadline), left: daysLeft(deadline, today), actionLabel: "Sudah", href: "/bpjs" }));
    }
  }

  // ---- payment on the 8th: this month from 3 days before, last month while it is still not marked ----
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  for (const [yy, mm] of [[y, m - 1], [y, m]] as const) {
    const due = utc(yy, mm, PAYMENT_DAY);
    const left = daysLeft(due, today);
    if (!visible(due) || (mm === m && left > 3)) continue;
    const ym = monthKey(yy, mm);
    for (const [prefix, label] of [["PAY_KES", "Kesehatan"], ["PAY_TK", "Ketenagakerjaan"]] as const) {
      const key = `${prefix}:${ym}`;
      if (done.has(key)) continue;
      rows.push(
        row(key, {
          type: `Pembayaran · setiap tanggal ${PAYMENT_DAY}`,
          title: `Bayar BPJS ${label} bulan ${monthName(due.getUTCMonth())}`,
          who: `Jatuh tempo ${dayWithWeekday(due)}.`,
          left,
          actionLabel: "Sudah dibayar",
          href: "/bpjs",
        })
      );
    }
  }

  // ---- monthly list of all harian lepas and magang: next month's from the 25th, this month's while it is not marked ----
  for (const [yy, mm] of [[y, m], [y, m + 1]] as const) {
    const deadline = monthlyListDeadline(yy, mm);
    const left = daysLeft(deadline, today);
    const upcoming = left >= 0;
    if (!visible(deadline) || (upcoming && today.getUTCDate() < MONTHLY_LIST_FROM_DAY)) continue;
    const target = utc(yy, mm, 1);
    const ym = monthKey(target.getUTCFullYear(), target.getUTCMonth());
    if (done.has(`MONTHLY_LIST:${ym}`)) continue;
    rows.push(
      row(null, {
        type: "Daftar BPJS TK · setiap bulan",
        title: `Daftar harian lepas dan magang untuk bulan ${monthName(target.getUTCMonth())}`,
        who: `${input.activeListSize} orang aktif. Batas: ${dayText(deadline)}.`,
        left,
        actionLabel: "Buka daftar",
        href: `/bpjs?bulan=${ym}`,
      })
    );
  }

  return rows;
}
