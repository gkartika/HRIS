import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { DEFAULT_START_TIME, DEFAULT_GRACE_MINUTES, defaultEndTimeLabel } from "@/lib/attendance";
import { MobileCheckForm } from "../attendance/mobile-check-form";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// Version after UAT: moved from its own /attendance page straight onto
// Beranda, per direct request — no separate nav item needed for something
// every Mobile-assigned employee does once or twice a day. Self-adapts the
// same way the old page did: nothing for an employee with no
// AttendanceAssignment yet, an informational note for Fingerprint, the two
// (now clearly differentiated) actions for Mobile.
export async function AttendanceCheckSection({ employeeId }: { employeeId: string }) {
  const assignment = await prisma.attendanceAssignment.findFirst({
    where: { employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!assignment) return null;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [checkInEvent, checkOutEvent] =
    assignment.method === "MOBILE"
      ? await Promise.all([
          prisma.attendanceEvent.findFirst({ where: { employeeId, eventType: "CHECK_IN", eventAt: { gte: start, lt: end } } }),
          prisma.attendanceEvent.findFirst({ where: { employeeId, eventType: "CHECK_OUT", eventAt: { gte: start, lt: end } } }),
        ])
      : [null, null];

  if (assignment.method === "FINGERPRINT") {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {t("attendance.fingerprintNotice")}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p>
          {t("attendance.todayTitle")} —{" "}
          {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })} · Jadwal:{" "}
          {DEFAULT_START_TIME}–{defaultEndTimeLabel(now)} (toleransi {DEFAULT_GRACE_MINUTES} menit)
        </p>
        <div className="flex gap-4 text-xs">
          <span className={checkInEvent ? "text-emerald-700" : "text-slate-400"}>
            {checkInEvent ? t("attendance.alreadyCheckedIn", { time: formatTime(checkInEvent.eventAt) }) : t("attendance.notCheckedInYet")}
          </span>
          <span className={checkOutEvent ? "text-amber-700" : "text-slate-400"}>
            {checkOutEvent ? t("attendance.alreadyCheckedOut", { time: formatTime(checkOutEvent.eventAt) }) : t("attendance.notCheckedOutYet")}
          </span>
        </div>
      </div>

      {(!checkInEvent || !checkOutEvent) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {!checkInEvent && <MobileCheckForm eventType="CHECK_IN" label={t("attendance.checkInButton")} />}
          {!checkOutEvent && <MobileCheckForm eventType="CHECK_OUT" label={t("attendance.checkOutButton")} />}
        </div>
      )}
    </div>
  );
}
