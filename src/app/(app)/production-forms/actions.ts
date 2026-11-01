"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, isProductionAdmin } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import {
  cancelForm,
  decideLeaveWork,
  getActiveDisciplines,
  getProductionDepartment,
  handOverDiscipline,
  leaderDecide,
  payrollDecide,
  saveDiscipline,
  saveExtraWork,
  saveLeaveWork,
  submitExisting,
  type DisciplineInput,
  type ExtraWorkInput,
  type LeaveWorkInput,
} from "@/lib/production-forms-service";
import { formHref } from "@/lib/production-forms";
import type { DisciplineKind, LeaveWorkDecision, ProductionFormKind } from "@/generated/prisma/enums";

export type SaveResult = { error?: string; id?: string; href?: string; warning?: string };

function refresh(kind: ProductionFormKind, id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/production-forms");
  if (id) revalidatePath(formHref(kind, id));
}

// The Admin Produksi login only: acts for the Production department.
async function clerk() {
  const session = await requireSession();
  if (!isProductionAdmin(session)) return { error: t("common.forbidden") } as const;
  const dept = await getProductionDepartment();
  if (!dept) return { error: "Departemen Production tidak ditemukan di struktur organisasi." } as const;
  return { departmentId: dept.id, actor: { accountId: session.user.id, name: session.user.name ?? "Production Department" } } as const;
}

const done = (kind: ProductionFormKind, r: { ok: true; id: string } | { ok: false; error: string }): SaveResult => {
  if (!r.ok) return { error: r.error };
  refresh(kind, r.id);
  return { id: r.id, href: formHref(kind, r.id) };
};

export async function saveExtraWorkAction(input: ExtraWorkInput, id: string | null, submit: boolean): Promise<SaveResult> {
  const c = await clerk();
  if ("error" in c) return { error: c.error };
  return done("EXTRA_WORK", await saveExtraWork({ id: id ?? undefined, input, departmentId: c.departmentId, actor: c.actor, submit }));
}

export async function saveLeaveWorkAction(input: LeaveWorkInput, id: string | null, submit: boolean): Promise<SaveResult> {
  const c = await clerk();
  if ("error" in c) return { error: c.error };
  return done("LEAVE_WORK", await saveLeaveWork({ id: id ?? undefined, input, departmentId: c.departmentId, actor: c.actor, submit }));
}

export async function saveDisciplineAction(input: DisciplineInput, id: string | null, submit: boolean): Promise<SaveResult> {
  const c = await clerk();
  if ("error" in c) return { error: c.error };
  return done("DISCIPLINE", await saveDiscipline({ id: id ?? undefined, input, departmentId: c.departmentId, actor: c.actor, submit }));
}

export async function submitExistingAction(kind: ProductionFormKind, id: string): Promise<SaveResult> {
  const c = await clerk();
  if ("error" in c) return { error: c.error };
  return done(kind, await submitExisting(kind, id, c.departmentId, c.actor));
}

export async function cancelFormAction(kind: ProductionFormKind, id: string, reason: string): Promise<SaveResult> {
  const c = await clerk();
  if ("error" in c) return { error: c.error };
  return done(kind, await cancelForm(kind, id, c.departmentId, c.actor, reason));
}

// 3A or 3B of the form's department.
export async function leaderDecideAction(kind: ProductionFormKind, id: string, decision: "APPROVE" | "REJECT" | "RETURN", note: string): Promise<SaveResult> {
  const session = await requireSession();
  if (!session.user.employeeId) return { error: t("common.forbidden") };
  return done(kind, await leaderDecide(kind, id, decision, note, session.user.employeeId, session.user.id));
}

// Admin SDM.
async function sdm() {
  const session = await requireSession();
  if (!isHrAdmin(session)) return { error: t("common.forbidden") } as const;
  return { actor: { accountId: session.user.id, name: session.user.name ?? "Admin SDM" } } as const;
}

export async function payrollDecideAction(id: string, decision: "APPROVE" | "REJECT" | "RETURN", finals: Record<string, number | null>, note: string): Promise<SaveResult> {
  const a = await sdm();
  if ("error" in a) return { error: a.error };
  return done("EXTRA_WORK", await payrollDecide(id, decision, finals, note, a.actor));
}

export async function decideLeaveWorkAction(id: string, decision: LeaveWorkDecision, note: string): Promise<SaveResult> {
  const a = await sdm();
  if ("error" in a) return { error: a.error };
  const r = await decideLeaveWork(id, decision, note, a.actor);
  const out = done("LEAVE_WORK", r);
  if (r.ok && r.warning) out.warning = r.warning;
  revalidatePath("/attendance/reconciliation");
  return out;
}

export async function handOverDisciplineAction(id: string, handedOverDate: string): Promise<SaveResult> {
  const a = await sdm();
  if ("error" in a) return { error: a.error };
  return done("DISCIPLINE", await handOverDiscipline(id, handedOverDate, a.actor));
}

export interface ActiveSp {
  requestNumber: string;
  kind: DisciplineKind;
  handedOverAt: string;
  validUntil: string;
}

// The Surat Peringatan an employee still has in force, shown while a new one is being written.
export async function activeDisciplinesAction(employeeId: string): Promise<ActiveSp[]> {
  const c = await clerk();
  if ("error" in c) return [];
  const rows = await getActiveDisciplines(employeeId);
  return rows.map((r) => ({ requestNumber: r.requestNumber, kind: r.kind, handedOverAt: (r.handedOverAt ?? new Date()).toISOString().slice(0, 10), validUntil: (r.validUntil ?? new Date()).toISOString().slice(0, 10) }));
}
