// Loads the interview standard for the forms and the guide page.
import { prisma } from "@/lib/db";
import { resolveStandard, type AspectStandard } from "@/lib/interview-standard";

export interface GuideAspect {
  id: string;
  label: string;
  optional: boolean;
  standard: AspectStandard | null;
}

export interface GuideData {
  header: { docNumber: string | null; revision: string | null; effectiveDate: string | null };
  aspects: GuideAspect[];
}

export const standardInclude = {
  levels: { select: { score: true, description: true } },
  standardOf: { select: { id: true, definition: true, note: true, levels: { select: { score: true, description: true } } } },
} as const;

// Active aspects of one audience, each with the standard it shows (its own or the shared one), in the order of the form.
export async function loadAspectsWithStandard(audience: "USER" | "HR"): Promise<GuideAspect[]> {
  const aspects = await prisma.recruitmentInterviewAspect.findMany({
    where: { active: true, audience },
    orderBy: { sortOrder: "asc" },
    include: standardInclude,
  });
  return aspects.map((a) => ({ id: a.id, label: a.label, optional: a.optional, standard: resolveStandard(a) }));
}

// The whole matrix as the interviewers read it: the user aspects (the HR form shares the same standards).
export async function loadGuide(): Promise<GuideData> {
  const [aspects, settings] = await Promise.all([
    loadAspectsWithStandard("USER"),
    prisma.recruitmentSetting.findUnique({ where: { id: "default" }, select: { standardDocNumber: true, standardRevision: true, standardEffectiveDate: true } }),
  ]);
  return {
    header: { docNumber: settings?.standardDocNumber ?? null, revision: settings?.standardRevision ?? null, effectiveDate: settings?.standardEffectiveDate ?? null },
    aspects: aspects.filter((a) => a.standard),
  };
}
