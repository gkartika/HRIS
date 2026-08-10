import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { DEFAULT_START_TIME, DEFAULT_GRACE_MINUTES, defaultEndTimeLabel } from "@/lib/attendance";
import { MobileCheckForm } from "./mobile-check-form";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default async function AttendancePage() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const assignment = await prisma.attendanceAssignment.findFirst({
    where: { employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [checkInEvent, checkOutEvent] = assignment
    ? await Promise.all([
        prisma.attendanceEvent.findFirst({ where: { employeeId, eventType: "CHECK_IN", eventAt: { gte: start, lt: end } } }),
        prisma.attendanceEvent.findFirst({ where: { employeeId, eventType: "CHECK_OUT", eventAt: { gte: start, lt: end } } }),
      ])
    : [null, null];

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("attendance.todayTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>

      {!assignment && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("attendance.noAssignmentNotice")}
        </p>
      )}

      {assignment?.method === "FINGERPRINT" && (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t("attendance.fingerprintNotice")}
        </p>
      )}

      {assignment?.method === "MOBILE" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            <p>
              Jadwal: {DEFAULT_START_TIME}–{defaultEndTimeLabel(now)} (toleransi {DEFAULT_GRACE_MINUTES} menit)
            </p>
            <p className="mt-1">
              {checkInEvent
                ? t("attendance.alreadyCheckedIn", { time: formatTime(checkInEvent.eventAt) })
                : t("attendance.notCheckedInYet")}
            </p>
            {checkOutEvent && <p>{t("attendance.alreadyCheckedOut", { time: formatTime(checkOutEvent.eventAt) })}</p>}
          </div>

          {!checkInEvent && <MobileCheckForm eventType="CHECK_IN" label={t("attendance.checkInButton")} />}
          {checkInEvent && !checkOutEvent && <MobileCheckForm eventType="CHECK_OUT" label={t("attendance.checkOutButton")} />}
        </div>
      )}
    </div>
  );
}
