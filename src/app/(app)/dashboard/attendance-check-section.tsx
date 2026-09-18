import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { DEFAULT_START_TIME, DEFAULT_GRACE_MINUTES, defaultEndTimeLabel } from "@/lib/attendance";
import { MobileCheckForm } from "../attendance/mobile-check-form";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Visual "Mulai → Selesai" step ladder replacing plain status text, per
// direct request — same underlying check-in/out state as before, just
// presented as two connected steps so the day's progress reads at a glance.
function AttendanceStepper({ checkInEvent, checkOutEvent }: { checkInEvent: { eventAt: Date } | null; checkOutEvent: { eventAt: Date } | null }) {
  const step1Done = !!checkInEvent;
  const step2Done = !!checkOutEvent;

  return (
    <div className="mt-3 flex items-center">
      <StepNode done={step1Done} active={!step1Done} label="Mulai" time={checkInEvent ? formatTime(checkInEvent.eventAt) : undefined} />
      <div className={`mx-2 h-0.5 flex-1 ${step1Done ? "bg-emerald-500" : "bg-slate-200"}`} />
      <StepNode
        done={step2Done}
        active={step1Done && !step2Done}
        label="Selesai"
        time={checkOutEvent ? formatTime(checkOutEvent.eventAt) : undefined}
      />
    </div>
  );
}

function StepNode({ done, active, label, time }: { done: boolean; active: boolean; label: string; time?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : active
              ? "border-brand bg-white text-brand"
              : "border-slate-200 bg-white text-slate-300"
        }`}
      >
        {done ? <CheckIcon /> : label === "Mulai" ? "1" : "2"}
      </div>
      <div className="text-center leading-tight">
        <p className={`text-[11px] font-semibold ${done ? "text-emerald-700" : active ? "text-brand" : "text-slate-400"}`}>{label}</p>
        <p className="text-[10px] text-slate-400">{time ?? " "}</p>
      </div>
    </div>
  );
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p>
          {t("attendance.todayTitle")} —{" "}
          {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })} · Jadwal:{" "}
          {DEFAULT_START_TIME}–{defaultEndTimeLabel(now)} (toleransi {DEFAULT_GRACE_MINUTES} menit)
        </p>
        <div className="mx-auto max-w-xs">
          <AttendanceStepper checkInEvent={checkInEvent} checkOutEvent={checkOutEvent} />
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
