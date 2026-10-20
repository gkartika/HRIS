import Link from "next/link";
import { startOfCompanyDay, DAY_MS } from "@/lib/company-time";
import { prisma } from "@/lib/db";
import { Suspense } from "react";
import { AttendanceCheckSection } from "./attendance-check-section";
import { InternalJobsCard, RecruitmentTasksCard } from "./internal-jobs-card";

function TodayIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

// Manufacturing floor staff (per direct user request) need the fewest taps
// to the two things they actually do every day — check in/out and ask for
// leave — not the admin-oriented stat cards and merged approvals section
// (dashboard/page.tsx renders this instead of that section entirely for
// anyone with no admin/managerial capability at all). AttendanceCheckSection
// is reused as-is — the real, already-functional check-in/out flow, not
// reimplemented — just given more prominent big-tile framing here.
export async function SimpleKaryawanHome({ employeeId, userName }: { employeeId: string; userName: string }) {
  const now = new Date();
  const start = startOfCompanyDay(now);
  const end = new Date(start.getTime() + DAY_MS);
  const [checkInEvent, checkOutEvent] = await Promise.all([
    prisma.attendanceEvent.findFirst({ where: { employeeId, eventType: "CHECK_IN", eventAt: { gte: start, lt: end } } }),
    prisma.attendanceEvent.findFirst({ where: { employeeId, eventType: "CHECK_OUT", eventAt: { gte: start, lt: end } } }),
  ]);

  const tasks: { label: string; done: boolean }[] = [];
  if (!checkInEvent) tasks.push({ label: "Belum Check-in hari ini", done: false });
  if (checkInEvent && !checkOutEvent) tasks.push({ label: "Belum Check-out hari ini", done: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Selamat Datang, {userName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/absences/new"
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border-2 border-brand-soft bg-brand-soft text-brand"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70">
            <TodayIcon />
          </span>
          <span className="text-base font-extrabold">Ajukan Cuti</span>
        </Link>
        <Link
          href="/profile"
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-700"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70">
            <ProfileIcon />
          </span>
          <span className="text-base font-extrabold">Info Saya</span>
        </Link>
      </div>

      <AttendanceCheckSection employeeId={employeeId} />

      <Suspense fallback={null}>
        <RecruitmentTasksCard employeeId={employeeId} />
      </Suspense>

      <Suspense fallback={null}>
        <InternalJobsCard employeeId={employeeId} />
      </Suspense>

      {tasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Tugas Anda Hari Ini</h2>
          <div className="mt-3 flex flex-col">
            {tasks.map((task) => (
              <label key={task.label} className="flex items-center gap-4 border-t border-slate-100 py-3.5 first:border-t-0">
                <input type="checkbox" checked={task.done} readOnly className="h-6 w-6 accent-brand" />
                <span className="text-base text-slate-900">{task.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
