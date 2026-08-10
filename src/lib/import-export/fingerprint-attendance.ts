import { prisma } from "@/lib/db";
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

// Fingerprint attendance events are append-only, same as Assignment import —
// every valid row is always a CREATE, there is no natural key to update.
// Dedup (idempotent re-import of the same export file) is enforced two ways:
// against rows already committed to the database, and against rows earlier
// in the same file, since a re-exported machine log commonly overlaps the
// previous export's date range.
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
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

export async function commitRow(raw: Record<string, string>): Promise<CommitResult> {
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
