"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { companyToday, DAY_MS } from "@/lib/company-time";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { BPJS_TASK_KEY, taskKind } from "@/lib/bpjs-reminders";
import type { BpjsTaskKind } from "@/generated/prisma/enums";

export type BpjsResult = { error?: string; saved?: number };

async function adminSession() {
  const session = await requireSession();
  return isHrAdmin(session) ? session : null;
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/bpjs");
}

// "Sudah": close one reminder. Marking twice is harmless.
export async function markBpjsDoneAction(key: string): Promise<BpjsResult> {
  const session = await adminSession();
  if (!session) return { error: "Hanya Admin SDM yang bisa menandai pengingat BPJS." };
  if (!BPJS_TASK_KEY.test(key)) return { error: "Pengingat tidak dikenali." };
  const kind = taskKind(key) as BpjsTaskKind;
  const existing = await prisma.bpjsTaskDone.findUnique({ where: { taskKey: key }, select: { id: true } });
  if (!existing) {
    const created = await prisma.bpjsTaskDone.create({ data: { taskKey: key, kind, markedByAccountId: session.user.id }, select: { id: true } }).catch(() => null);
    if (created) await logAudit({ actorAccountId: session.user.id, action: "CREATE", datasetName: "BpjsTaskDone", recordId: created.id, reason: `BPJS reminder marked done: ${key}` });
  }
  refresh();
  return {};
}

// Take a mistaken "Sudah" back: the reminder comes back on the Beranda.
export async function undoBpjsMarkAction(key: string): Promise<BpjsResult> {
  const session = await adminSession();
  if (!session) return { error: "Hanya Admin SDM yang bisa membatalkan tanda ini." };
  if (!BPJS_TASK_KEY.test(key)) return { error: "Pengingat tidak dikenali." };
  const existing = await prisma.bpjsTaskDone.findUnique({ where: { taskKey: key }, select: { id: true } });
  if (!existing) return {};
  await prisma.bpjsTaskDone.delete({ where: { id: existing.id } });
  await logAudit({ actorAccountId: session.user.id, action: "DELETE", datasetName: "BpjsTaskDone", recordId: existing.id, reason: `BPJS reminder mark taken back: ${key}` });
  refresh();
  return {};
}

// Fill in the start date of harian lepas / magang who have none. Only people without a start date are touched.
export async function saveStartDatesAction(entries: { id: string; date: string }[]): Promise<BpjsResult> {
  const session = await adminSession();
  if (!session) return { error: "Hanya Admin SDM yang bisa mengisi tanggal masuk." };
  const today = companyToday();
  const max = today.getTime() + 365 * DAY_MS;
  const parsed: { id: string; date: Date }[] = [];
  for (const e of entries) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date);
    if (!m) continue;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000 || date.getTime() > max) return { error: "Ada tanggal masuk yang tidak masuk akal. Periksa lagi." };
    parsed.push({ id: e.id, date });
  }
  if (parsed.length === 0) return { error: "Isi sedikitnya satu tanggal." };

  const eligible = await prisma.employee.findMany({
    where: { id: { in: parsed.map((p) => p.id) }, activeFlag: true, employmentStatus: { in: ["HARIAN_LEPAS", "MAGANG"] }, hireDate: null },
    select: { id: true },
  });
  const ok = new Set(eligible.map((e) => e.id));
  const rows = parsed.filter((p) => ok.has(p.id));
  await prisma.$transaction(rows.map((p) => prisma.employee.update({ where: { id: p.id }, data: { hireDate: p.date } })));
  for (const p of rows) {
    await logAudit({ actorAccountId: session.user.id, action: "UPDATE", datasetName: "Employee", recordId: p.id, fieldName: "hireDate", newValueMasked: p.date.toISOString().slice(0, 10), reason: "Start date filled in from the BPJS page" });
  }
  refresh();
  return { saved: rows.length };
}
