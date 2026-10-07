import { companyToday } from "@/lib/company-time";

// Which employee-days carry a real check-in / check-out, worked out directly
// from the punch events. The grid and the unresolved-days queue used to rely
// only on DailyAttendanceRecord.checkIn/OutEventId, which the nightly job fills
// in for finished days — so today's punch (or a punch that arrived after the
// day's record already existed) stayed invisible. Reading the events makes it
// show immediately; a day counts as punched if EITHER source says so.
//
// A punch belongs to the company-local (WIB) day it happened on, the same rule
// the nightly job uses to link events to records.
export interface PunchDay {
  hasCheckIn: boolean;
  hasCheckOut: boolean;
}

export function punchDayKey(employeeId: string, day: Date): string {
  return `${employeeId}|${day.getTime()}`;
}

export function buildPunchDayLookup(
  events: { employeeId: string; eventType: "CHECK_IN" | "CHECK_OUT"; eventAt: Date }[]
): Map<string, PunchDay> {
  const map = new Map<string, PunchDay>();
  for (const e of events) {
    const key = punchDayKey(e.employeeId, companyToday(e.eventAt));
    const day = map.get(key) ?? { hasCheckIn: false, hasCheckOut: false };
    if (e.eventType === "CHECK_IN") day.hasCheckIn = true;
    else day.hasCheckOut = true;
    map.set(key, day);
  }
  return map;
}
