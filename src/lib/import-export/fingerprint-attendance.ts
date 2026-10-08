import { prisma } from "@/lib/db";
import { companyToday, WIB_OFFSET_MS, formatCompanyTime } from "@/lib/company-time";
import { normalizeName } from "@/lib/name-match";
import { normalizeWeekStart, buildIsScheduledToWorkLookup } from "@/lib/shift-assignment";
import type { AttendanceEventType } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";

export const label = "Absensi Fingerprint";
export const templateHeaders = ["fingerprintDeviceUserId", "eventType", "eventAt"];
export const templateExampleRow = {
  fingerprintDeviceUserId: "FP-1001",
  eventType: "CHECK_IN",
  eventAt: "2026-08-10 08:00:00",
};

const VALID_EVENT_TYPES = ["CHECK_IN", "CHECK_OUT"];

// Some fingerprint machines export only a display Name plus a Status label
// (ZKTeco-style "Name / Date-Time / Status", with "C/In" and "C/Out" and
// dates as DD/MM/YYYY) rather than the clean fingerprintDeviceUserId/
// eventType/eventAt shape the rest of this module assumes. Detected by
// header shape alone, so both formats work from the same upload with no
// extra UI choice.
function isRawMachineFormat(row: Record<string, string> | undefined): boolean {
  return !!row && "Name" in row && "Status" in row && "Date/Time" in row;
}

// The raw export's "DD/MM/YYYY HH:mm:ss" breaks native Date parsing (it's
// read as MM/DD and rejected, e.g. "21/09/2026" has no 21st month) — parsed
// explicitly instead. Same fixed +07:00 (Asia/Jakarta, no DST) convention as
// startOfCompanyDay: the numbers are wall-clock WIB time, converted to the
// real UTC instant that represents.
function parseMachineDateTime(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, ddStr, mmStr, yyyyStr, hhStr, minStr, ssStr] = match;
  const dd = Number(ddStr);
  const mm = Number(mmStr);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(
    Date.UTC(Number(yyyyStr), mm - 1, dd, Number(hhStr), Number(minStr), Number(ssStr)) - WIB_OFFSET_MS
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapMachineStatus(value: string): AttendanceEventType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "c/in") return "CHECK_IN";
  if (normalized === "c/out") return "CHECK_OUT";
  return null;
}

interface ParsedMachineRow {
  index: number;
  rowNumber: number;
  raw: Record<string, string>;
  error: string | null;
  employeeId?: string;
  eventType?: AttendanceEventType;
  eventAt?: Date;
  day?: Date;
}

// Fingerprint attendance events are append-only, same as Assignment import —
// every valid row is always a CREATE, there is no natural key to update.
// Dedup (idempotent re-import of the same export file) is enforced two ways:
// against rows already committed to the database, and against rows earlier
// in the same file, since a re-exported machine log commonly overlaps the
// previous export's date range.
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  if (isRawMachineFormat(rows[0])) return dryRunRawMachineFormat(rows);
  return dryRunCleanFormat(rows);
}

async function dryRunCleanFormat(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const assignments = await prisma.attendanceAssignment.findMany({
    where: { method: "FINGERPRINT", effectiveTo: null },
    select: { employeeId: true, fingerprintDeviceUserId: true },
  });
  const employeeIdByDeviceUserId = new Map(
    assignments.filter((a) => a.fingerprintDeviceUserId).map((a) => [a.fingerprintDeviceUserId as string, a.employeeId])
  );

  const seenInFile = new Set<string>();
  const result: DryRunRow[] = [];

  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2;
    const fingerprintDeviceUserId = raw.fingerprintDeviceUserId?.trim();
    const eventType = raw.eventType?.trim().toUpperCase();
    const eventAtRaw = raw.eventAt?.trim();

    const reasons: string[] = [];
    const employeeId = fingerprintDeviceUserId ? employeeIdByDeviceUserId.get(fingerprintDeviceUserId) : undefined;
    if (!fingerprintDeviceUserId || !employeeId) {
      reasons.push(`ID Perangkat Fingerprint "${fingerprintDeviceUserId}" tidak terdaftar pada karyawan manapun`);
    }
    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      reasons.push(`Jenis absensi (eventType) harus salah satu dari: ${VALID_EVENT_TYPES.join(", ")}`);
    }
    const eventAt = eventAtRaw ? new Date(eventAtRaw) : null;
    if (!eventAtRaw || !eventAt || Number.isNaN(eventAt.getTime())) {
      reasons.push("Waktu (eventAt) wajib diisi dengan format tanggal/waktu yang valid");
    }

    if (reasons.length === 0 && employeeId && eventAt) {
      const dedupKey = `${employeeId}|${eventType}|${eventAt.toISOString()}`;
      if (seenInFile.has(dedupKey)) {
        reasons.push("Baris ini duplikat dari baris lain pada berkas yang sama");
      } else {
        const existing = await prisma.attendanceEvent.findFirst({
          where: { employeeId, eventType: eventType as AttendanceEventType, eventAt },
          select: { id: true },
        });
        if (existing) {
          reasons.push("Sudah pernah diimpor sebelumnya (waktu dan jenis absensi sama)");
        } else {
          seenInFile.add(dedupKey);
        }
      }
    }

    result.push({
      rowNumber,
      raw,
      isValid: reasons.length === 0,
      rejectionReason: reasons.length > 0 ? reasons.join("; ") : null,
      action: reasons.length > 0 ? null : "CREATE",
    });
  }

  return result;
}

// Raw machine exports commonly contain several scans of the same person/
// status seconds to minutes apart (a misread finger, scanned again) — not
// separate real events. Per calendar day, the earliest scan is kept for a
// Check-In and the latest for a Check-Out (the day's real start/end); every
// other scan in that group is rejected with an explanatory note, same
// "duplicate in file" mechanism the clean format above already uses for
// exact duplicates, just extended to near-duplicates.
//
// A punch is also rejected (not just flagged) when the employee's schedule
// says they weren't due to work that day — per direct request, a real extra
// shift is expected to go through Jadwal Shift / Penugasan Absensi first,
// not be inferred from a fingerprint scan alone.
async function dryRunRawMachineFormat(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const assignments = await prisma.attendanceAssignment.findMany({
    where: { method: "FINGERPRINT", effectiveTo: null },
    select: { employeeId: true, fingerprintDeviceUserId: true },
  });
  // A name that matches more than one assignment maps to null (ambiguous) so
  // it's rejected explicitly instead of silently resolving to whichever
  // assignment happened to be read last.
  const employeeIdByName = new Map<string, string | null>();
  for (const a of assignments) {
    if (!a.fingerprintDeviceUserId) continue;
    const key = normalizeName(a.fingerprintDeviceUserId);
    employeeIdByName.set(key, employeeIdByName.has(key) ? null : a.employeeId);
  }

  const parsed: ParsedMachineRow[] = rows.map((raw, index) => {
    const rowNumber = index + 2;
    const name = raw.Name?.trim();
    const statusRaw = raw.Status?.trim();
    const dateRaw = raw["Date/Time"]?.trim();

    const errors: string[] = [];
    let employeeId: string | undefined;
    if (!name) {
      errors.push("Nama wajib diisi");
    } else {
      const match = employeeIdByName.get(normalizeName(name));
      if (match === undefined) {
        errors.push(
          `Nama "${name}" pada mesin fingerprint tidak terdaftar pada karyawan manapun — isi ID Perangkat Fingerprint karyawan dengan nama persis ini di Penugasan Absensi`
        );
      } else if (match === null) {
        errors.push(`Nama "${name}" cocok dengan lebih dari satu karyawan — perbaiki ID Perangkat Fingerprint yang duplikat di Penugasan Absensi`);
      } else {
        employeeId = match;
      }
    }

    const eventType = statusRaw ? mapMachineStatus(statusRaw) : null;
    if (!statusRaw || !eventType) {
      errors.push(`Status "${statusRaw ?? ""}" tidak dikenali — harus C/In atau C/Out`);
    }

    const eventAt = dateRaw ? parseMachineDateTime(dateRaw) : null;
    if (!dateRaw || !eventAt) {
      errors.push("Format Tanggal/Waktu tidak valid — harus DD/MM/YYYY HH:mm:ss");
    }

    return {
      index,
      rowNumber,
      raw,
      error: errors.length > 0 ? errors.join("; ") : null,
      employeeId,
      eventType: eventType ?? undefined,
      eventAt: eventAt ?? undefined,
      day: eventAt ? companyToday(eventAt) : undefined,
    };
  });

  // Group every cleanly-parsed-and-matched row by employee+type+day, and
  // pick the one scan per group that actually represents the day.
  const groups = new Map<string, ParsedMachineRow[]>();
  for (const p of parsed) {
    if (p.error || !p.employeeId || !p.eventType || !p.eventAt || !p.day) continue;
    const key = `${p.employeeId}|${p.eventType}|${p.day.getTime()}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  const winnerIndexes = new Set<number>();
  const duplicateNoteByIndex = new Map<number, string>();
  for (const list of groups.values()) {
    const sortedByTime = [...list].sort((a, b) => a.eventAt!.getTime() - b.eventAt!.getTime());
    const winner = list[0].eventType === "CHECK_IN" ? sortedByTime[0] : sortedByTime[sortedByTime.length - 1];
    winnerIndexes.add(winner.index);
    if (list.length > 1) {
      const winnerTime = formatCompanyTime(winner.eventAt!);
      for (const p of list) {
        if (p.index !== winner.index) {
          duplicateNoteByIndex.set(p.index, `Pemindaian ganda (${list.length}x pada hari ini) — sudah terwakili oleh baris pukul ${winnerTime}`);
        }
      }
    }
  }

  // Batch everything the surviving (winning) rows need checked against:
  // existing AttendanceEvents (idempotent re-import) and the work schedule.
  const winners = parsed.filter((p) => winnerIndexes.has(p.index));
  const employeeIds = [...new Set(winners.map((p) => p.employeeId!))];
  const dayTimes = [...new Set(winners.map((p) => p.day!.getTime()))];

  let existingKeys = new Set<string>();
  let isScheduledToWork: (employeeId: string, day: Date) => boolean = () => true;
  if (employeeIds.length > 0 && dayTimes.length > 0) {
    const minDay = new Date(Math.min(...dayTimes));
    const maxDayExclusive = new Date(Math.max(...dayTimes) + 24 * 60 * 60 * 1000);
    const weekStarts = [...new Set(winners.map((p) => normalizeWeekStart(p.day!).getTime()))].map((t) => new Date(t));

    const [existingEvents, holidays, scheduleRows, shiftAssignments] = await Promise.all([
      prisma.attendanceEvent.findMany({
        where: { employeeId: { in: employeeIds }, eventAt: { gte: minDay, lt: maxDayExclusive } },
        select: { employeeId: true, eventType: true, eventAt: true },
      }),
      prisma.companyHoliday.findMany({ where: { date: { gte: minDay, lt: maxDayExclusive } }, select: { date: true } }),
      prisma.workScheduleConfig.findMany(),
      prisma.shiftAssignment.findMany({ where: { employeeId: { in: employeeIds }, weekStartDate: { in: weekStarts } } }),
    ]);

    existingKeys = new Set(
      existingEvents.map((e) => `${e.employeeId}|${e.eventType}|${companyToday(e.eventAt).getTime()}`)
    );
    isScheduledToWork = buildIsScheduledToWorkLookup(holidays, scheduleRows, shiftAssignments);
  }

  return parsed.map((p): DryRunRow => {
    if (p.error) {
      return { rowNumber: p.rowNumber, raw: p.raw, isValid: false, rejectionReason: p.error, action: null };
    }
    if (!winnerIndexes.has(p.index)) {
      return {
        rowNumber: p.rowNumber,
        raw: p.raw,
        isValid: false,
        rejectionReason: duplicateNoteByIndex.get(p.index) ?? "Pemindaian ganda pada hari ini",
        action: null,
      };
    }
    const key = `${p.employeeId}|${p.eventType}|${p.day!.getTime()}`;
    if (existingKeys.has(key)) {
      return {
        rowNumber: p.rowNumber,
        raw: p.raw,
        isValid: false,
        rejectionReason: "Sudah pernah diimpor sebelumnya (karyawan ini sudah punya catatan absensi jenis ini pada tanggal ini)",
        action: null,
      };
    }
    if (!isScheduledToWork(p.employeeId!, p.day!)) {
      return {
        rowNumber: p.rowNumber,
        raw: p.raw,
        isValid: false,
        rejectionReason: "Karyawan tidak dijadwalkan bekerja pada tanggal ini — ajukan Jadwal Shift/Penugasan Absensi terlebih dahulu jika ini kerja tambahan",
        action: null,
      };
    }
    return { rowNumber: p.rowNumber, raw: p.raw, isValid: true, rejectionReason: null, action: "CREATE" };
  });
}

export async function commitRow(raw: Record<string, string>): Promise<CommitResult> {
  if (isRawMachineFormat(raw)) return commitRowRawMachineFormat(raw);
  return commitRowCleanFormat(raw);
}

async function commitRowCleanFormat(raw: Record<string, string>): Promise<CommitResult> {
  const fingerprintDeviceUserId = raw.fingerprintDeviceUserId.trim();
  const eventType = raw.eventType.trim().toUpperCase() as AttendanceEventType;
  const eventAt = new Date(raw.eventAt.trim());

  const assignment = await prisma.attendanceAssignment.findFirstOrThrow({
    where: { method: "FINGERPRINT", effectiveTo: null, fingerprintDeviceUserId },
  });

  const event = await prisma.attendanceEvent.create({
    data: {
      employeeId: assignment.employeeId,
      attendanceAssignmentId: assignment.id,
      eventType,
      eventSource: "FINGERPRINT_IMPORT",
      eventAt,
    },
  });

  return { id: event.id, action: "CREATE" };
}

// commitImportBatch only ever calls this for rows dryRun already marked
// valid, so the match-to-exactly-one-employee guarantee it computed should
// still hold here — re-derived independently rather than trusted across the
// two calls, same as the clean format above never trusting dryRun's lookup.
async function commitRowRawMachineFormat(raw: Record<string, string>): Promise<CommitResult> {
  const name = raw.Name.trim();
  const eventType = mapMachineStatus(raw.Status.trim());
  const eventAt = parseMachineDateTime(raw["Date/Time"].trim());
  if (!eventType || !eventAt) {
    throw new Error("Baris fingerprint tidak valid saat commit (status atau tanggal/waktu tidak terbaca).");
  }

  const assignments = await prisma.attendanceAssignment.findMany({
    where: { method: "FINGERPRINT", effectiveTo: null },
    select: { id: true, employeeId: true, fingerprintDeviceUserId: true },
  });
  const normalized = normalizeName(name);
  const matches = assignments.filter((a) => a.fingerprintDeviceUserId && normalizeName(a.fingerprintDeviceUserId) === normalized);
  if (matches.length !== 1) {
    throw new Error(`Tidak dapat mencocokkan nama "${name}" ke tepat satu karyawan saat commit.`);
  }
  const assignment = matches[0];

  const event = await prisma.attendanceEvent.create({
    data: {
      employeeId: assignment.employeeId,
      attendanceAssignmentId: assignment.id,
      eventType,
      eventSource: "FINGERPRINT_IMPORT",
      eventAt,
    },
  });

  return { id: event.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const events = await prisma.attendanceEvent.findMany({
    where: { eventSource: "FINGERPRINT_IMPORT" },
    include: { attendanceAssignment: true },
    orderBy: { eventAt: "desc" },
  });
  return {
    headers: templateHeaders,
    rows: events.map((e) => ({
      fingerprintDeviceUserId: e.attendanceAssignment?.fingerprintDeviceUserId ?? "",
      eventType: e.eventType,
      eventAt: e.eventAt.toISOString().slice(0, 19).replace("T", " "),
    })),
  };
}
