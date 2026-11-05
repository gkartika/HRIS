// Loads the evaluation standard for release, the evaluator form, the guide and the settings.
import { prisma } from "@/lib/db";
import { buildMatrixDefinition, type MatrixDefinition } from "@/lib/evaluation";
import { buildCriterionStandard, pickVariantKey, type CriterionStandardSource, type VariantContext } from "@/lib/evaluation-standard";

const criterionInclude = {
  variants: { select: { key: true, label: true, sortOrder: true, appliesToLevels: true, appliesToSubordinates: true }, orderBy: { sortOrder: "asc" } },
  levels: { select: { variantKey: true, score: true, description: true } },
} as const;

export async function loadCriteriaWithStandards() {
  return prisma.evaluationCriterion.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: criterionInclude,
  });
}

// Who the standard is for: the level of the seat the evaluation was made for (else the employee's current seat), the employment
// status, and whether anyone reports to that seat.
export async function loadVariantContext(employeeId: string, snapshotPositionId: string | null): Promise<VariantContext> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { employmentStatus: true, currentPositionId: true } });
  const positionId = snapshotPositionId ?? employee?.currentPositionId ?? null;
  const [position, reports] = await Promise.all([
    positionId ? prisma.position.findUnique({ where: { id: positionId }, select: { jobLevel: true } }) : Promise.resolve(null),
    positionId ? prisma.position.count({ where: { reportsToPositionId: positionId, positionStatus: "FILLED", archived: false } }) : Promise.resolve(0),
  ]);
  return { jobLevel: position?.jobLevel ?? null, employmentStatus: employee?.employmentStatus ?? null, hasSubordinates: reports > 0 };
}

export type CriterionRowWithStandard = Awaited<ReturnType<typeof loadCriteriaWithStandards>>[number];

const sourceOf = (c: CriterionRowWithStandard): CriterionStandardSource => ({ definition: c.definition, note: c.note, variants: c.variants, levels: c.levels });

// The copy an evaluation is released with: the active criteria and, for each, its standard with the version chosen for this
// person (or the one Admin SDM picked, `overrides` by criterion key).
export function buildReleaseMatrix(criteria: CriterionRowWithStandard[], ctx: VariantContext, overrides: Record<string, string> = {}): MatrixDefinition {
  return buildMatrixDefinition(criteria.map((c) => ({ section: c.section, key: c.key, label: c.label, sortOrder: c.sortOrder, active: c.active, standard: buildCriterionStandard(sourceOf(c), ctx, overrides[c.key]) })));
}

// The criteria that have more than one version, with the version SAPA would choose for this person (shown in the release form).
export function variantChoices(criteria: CriterionRowWithStandard[], ctx: VariantContext) {
  return criteria
    .filter((c) => c.active && c.variants.length > 1)
    .map((c) => ({
      key: c.key,
      label: c.label,
      suggested: pickVariantKey(c.variants, ctx) ?? c.variants[0].key,
      variants: c.variants.map((v) => ({ key: v.key, label: v.label })),
    }));
}

export interface EvaluationGuide {
  header: { docNumber: string | null; revision: string | null; effectiveDate: string | null };
  performance: GuideCriterion[];
  tataNilai: GuideCriterion[];
}

export interface GuideCriterion {
  key: string;
  label: string;
  definition: string | null;
  note: string | null;
  variants: { key: string; label: string; levels: { score: number; description: string }[] }[];
}

// The whole matrix for the guide panel and the printable page: every version of every active criterion.
export async function loadEvaluationGuide(): Promise<EvaluationGuide> {
  const [criteria, setting] = await Promise.all([
    loadCriteriaWithStandards(),
    prisma.evaluationSetting.findUnique({ where: { id: "default" }, select: { standardDocNumber: true, standardRevision: true, standardEffectiveDate: true } }),
  ]);
  const of = (section: "PERFORMANCE" | "TATA_NILAI"): GuideCriterion[] =>
    criteria
      .filter((c) => c.section === section && c.active)
      .flatMap((c) => {
        const s = buildCriterionStandard(sourceOf(c), { jobLevel: null, employmentStatus: null, hasSubordinates: false });
        return s ? [{ key: c.key, label: c.label, definition: s.definition, note: s.note, variants: s.variants.map((v) => ({ key: v.key, label: v.label, levels: [...v.levels].sort((a, b) => a.score - b.score) })) }] : [];
      });
  return {
    header: { docNumber: setting?.standardDocNumber ?? null, revision: setting?.standardRevision ?? null, effectiveDate: setting?.standardEffectiveDate ?? null },
    performance: of("PERFORMANCE"),
    tataNilai: of("TATA_NILAI"),
  };
}
