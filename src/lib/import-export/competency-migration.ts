import { prisma } from "@/lib/db";
import { computeCompetencyAchievementPct } from "@/lib/competency";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import type { Session } from "next-auth";
import type { CompetencyCategory } from "@/generated/prisma/enums";

// COM-19/ACC-24: "Migrate historical Required and Actual competency results
// once through a normalized, audited HR Admin staging import. Preserve
// source sheet/row and selected historical cycle/date. Recalculate app
// gaps/achievement, leave unavailable Company Values blank, create no
// training, and keep routine assessment imports disabled." One row = one
// historical (Employee, Competency, Period) result — several rows for the
// same Employee+Period accumulate onto one historical CompetencyAssessment,
// created isHistorical/isHistoricalMigration on first sight.
export const label = "Migrasi Historis Kompetensi";
export const templateHeaders = ["employeeNumber", "competency", "requiredLevel", "actualLevel", "periodLabel", "sourceSheet", "sourceRow"];
export const templateExampleRow = {
  employeeNumber: "EMP-0001",
  competency: "5R",
  requiredLevel: "3",
  actualLevel: "2",
  periodLabel: "2025 H1 (Historis)",
  sourceSheet: "Cutting",
  sourceRow: "12",
};

function slugPeriodLabel(periodLabel: string): string {
  return periodLabel
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

interface CompetencyLookupEntry {
  id: string;
  name: string;
  category: CompetencyCategory;
}

// COM-18: resolves a raw sheet label to exactly one CompetencyDefinition via
// its stable code/name or a reviewed alias (aliasesCsv). A label matching
// more than one definition (a genuinely ambiguous source label) is treated
// as unresolved here — dryRun rejects it rather than guessing.
async function buildCompetencyLookup(): Promise<Map<string, CompetencyLookupEntry[]>> {
  const definitions = await prisma.competencyDefinition.findMany({
    where: { activeFlag: true, frameworkVersion: { status: "ACTIVE" } },
    select: { id: true, name: true, category: true, aliasesCsv: true },
  });
  const lookup = new Map<string, CompetencyLookupEntry[]>();
  const add = (key: string, entry: CompetencyLookupEntry) => {
    const normalized = key.trim().toLowerCase();
    if (!normalized) return;
    const list = lookup.get(normalized) ?? [];
    if (!list.some((e) => e.id === entry.id)) list.push(entry);
    lookup.set(normalized, list);
  };
  for (const def of definitions) {
    const entry: CompetencyLookupEntry = { id: def.id, name: def.name, category: def.category };
    add(def.name, entry);
    for (const alias of def.aliasesCsv?.split(",") ?? []) add(alias, entry);
  }
  return lookup;
}

function parseRequiredLevel(raw: string): { isRequired: boolean; requiredLevel: number | null } | null {
  const trimmed = raw.trim();
  if (!trimmed || /^n\/?a$/i.test(trimmed)) return { isRequired: false, requiredLevel: null };
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return { isRequired: true, requiredLevel: n };
}

function parseActualLevel(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || n > 5) return null;
  return n;
}

export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const employees = await prisma.employee.findMany({ select: { id: true, employeeNumber: true } });
  const employeeIdByNumber = new Map(employees.map((e) => [e.employeeNumber, e.id]));
  const competencyLookup = await buildCompetencyLookup();

  const existingKeys = new Set(
    (
      await prisma.competencyAssessmentItem.findMany({
        where: { assessment: { isHistoricalMigration: true } },
        select: {
          competencyDefinitionId: true,
          assessment: { select: { employeeId: true, cycle: { select: { cycleCode: true } } } },
        },
      })
    ).map((r) => `${r.assessment.employeeId}|${r.competencyDefinitionId}|${r.assessment.cycle.cycleCode}`)
  );

  const seenInFile = new Set<string>();
  const result: DryRunRow[] = [];

  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2;
    const employeeNumber = raw.employeeNumber?.trim();
    const competencyLabel = raw.competency?.trim();
    const periodLabel = raw.periodLabel?.trim();

    const reasons: string[] = [];

    const employeeId = employeeNumber ? employeeIdByNumber.get(employeeNumber) : undefined;
    if (!employeeNumber || !employeeId) {
      reasons.push(`Nomor karyawan "${employeeNumber}" tidak ditemukan`);
    }

    const matches = competencyLabel ? competencyLookup.get(competencyLabel.toLowerCase()) : undefined;
    if (!competencyLabel || !matches || matches.length === 0) {
      reasons.push(`Kompetensi "${competencyLabel}" tidak dikenali pada Kerangka Kompetensi aktif`);
    } else if (matches.length > 1) {
      reasons.push(`Kompetensi "${competencyLabel}" cocok dengan lebih dari satu definisi (ambigu) — perlu pemetaan manual`);
    }

    const required = parseRequiredLevel(raw.requiredLevel ?? "");
    if (required === null) reasons.push("Level disyaratkan (requiredLevel) harus 1-5 atau N/A");

    const actualLevel = parseActualLevel(raw.actualLevel ?? "");
    if (raw.actualLevel?.trim() && actualLevel === null) reasons.push("Level aktual (actualLevel) harus 0-5");

    if (!periodLabel) reasons.push("Label periode historis (periodLabel) wajib diisi");

    if (reasons.length === 0 && employeeId && matches && matches.length === 1 && periodLabel) {
      const cycleCode = `HIST-${slugPeriodLabel(periodLabel)}`;
      const dedupKey = `${employeeId}|${matches[0].id}|${cycleCode}`;
      if (seenInFile.has(dedupKey) || existingKeys.has(dedupKey)) {
        reasons.push("Baris ini duplikat: kombinasi Karyawan + Kompetensi + Periode sudah ada");
      } else {
        seenInFile.add(dedupKey);
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

export async function commitRow(raw: Record<string, string>, session?: Session): Promise<CommitResult> {
  const employeeNumber = raw.employeeNumber.trim();
  const competencyLabel = raw.competency.trim();
  const periodLabel = raw.periodLabel.trim();
  const required = parseRequiredLevel(raw.requiredLevel ?? "");
  const actualLevel = parseActualLevel(raw.actualLevel ?? "");
  if (!required) throw new Error(`Invalid requiredLevel on row for ${employeeNumber}`);

  const employee = await prisma.employee.findUniqueOrThrow({ where: { employeeNumber } });

  const lookup = await buildCompetencyLookup();
  const matches = lookup.get(competencyLabel.toLowerCase());
  if (!matches || matches.length !== 1) throw new Error(`Unresolved competency label "${competencyLabel}"`);
  const definition = matches[0];

  const cycleCode = `HIST-${slugPeriodLabel(periodLabel)}`;

  // COM-06's ordinary cycle needs an active framework version; the
  // historical cycle borrows whichever is currently ACTIVE purely as a
  // stable FK target — its own frozen sourceDocNumber/date on the
  // definitions is what actually matters for COM-17 traceability.
  const [competencyFrameworkVersion, companyValueFrameworkVersion] = await Promise.all([
    prisma.competencyFrameworkVersion.findFirstOrThrow({ where: { status: "ACTIVE" } }),
    prisma.companyValueFrameworkVersion.findFirstOrThrow({ where: { status: "ACTIVE" } }),
  ]);

  let cycle = await prisma.competencyAssessmentCycle.findUnique({ where: { cycleCode } });
  if (!cycle) {
    cycle = await prisma.competencyAssessmentCycle.create({
      data: {
        cycleCode,
        periodLabel,
        cutoffDate: new Date(),
        startDate: new Date(),
        status: "CLOSED",
        isHistorical: true,
        competencyFrameworkVersionId: competencyFrameworkVersion.id,
        companyValueFrameworkVersionId: companyValueFrameworkVersion.id,
        openedByAccountId: session!.user.id,
        closedAt: new Date(),
      },
    });
  }

  let assessment = await prisma.competencyAssessment.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: employee.id } },
  });
  if (!assessment) {
    assessment = await prisma.competencyAssessment.create({
      data: {
        cycleId: cycle.id,
        employeeId: employee.id,
        positionId: employee.currentPositionId,
        isHistoricalMigration: true,
        // COM-19: "leave unavailable Company Values blank" — the historical
        // source carries competency Required/Actual only, never Company
        // Values, so no CompanyValueAssessmentItem rows are created here.
      },
    });
  }

  const item = await prisma.competencyAssessmentItem.create({
    data: {
      assessmentId: assessment.id,
      competencyDefinitionId: definition.id,
      competencyNameSnapshot: definition.name,
      categorySnapshot: definition.category,
      isRequired: required.isRequired,
      requiredLevel: required.requiredLevel,
      actualLevel,
      comment: raw.sourceSheet || raw.sourceRow ? `Sumber: ${raw.sourceSheet ?? "?"} baris ${raw.sourceRow ?? "?"}` : null,
    },
  });

  // COM-19: "Recalculate app gaps/achievement" — recomputed from every item
  // accumulated on this historical assessment so far, each time a new row
  // lands on it.
  const allItems = await prisma.competencyAssessmentItem.findMany({ where: { assessmentId: assessment.id } });
  const competencyAchievementPct = computeCompetencyAchievementPct(
    allItems.map((i) => ({ isRequired: i.isRequired, requiredLevel: i.requiredLevel, actualLevel: i.actualLevel }))
  );
  await prisma.competencyAssessment.update({
    where: { id: assessment.id },
    data: { competencyAchievementPct, completedAt: new Date() },
  });

  return { id: item.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const items = await prisma.competencyAssessmentItem.findMany({
    where: { assessment: { isHistoricalMigration: true } },
    include: { assessment: { include: { employee: true, cycle: true } } },
    orderBy: [{ assessment: { cycle: { cycleCode: "asc" } } }, { assessment: { employee: { employeeNumber: "asc" } } }],
  });
  return {
    headers: ["employeeNumber", "competency", "requiredLevel", "actualLevel", "periodLabel", "comment"],
    rows: items.map((i) => ({
      employeeNumber: i.assessment.employee.employeeNumber,
      competency: i.competencyNameSnapshot,
      requiredLevel: i.requiredLevel !== null ? String(i.requiredLevel) : "N/A",
      actualLevel: i.actualLevel !== null ? String(i.actualLevel) : "",
      periodLabel: i.assessment.cycle.periodLabel,
      comment: i.comment ?? "",
    })),
  };
}
