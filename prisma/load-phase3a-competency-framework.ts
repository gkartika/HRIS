// One-time loader for Phase 3A's real Competency Framework + Company Values
// (COM-18): fetches the authoritative "Competency Matrix and Company Values"
// Google Sheet fresh as XLSX and inserts it as one CompetencyFrameworkVersion
// + one CompanyValueFrameworkVersion. Idempotent on sourceDocNumber+revision
// — safe to re-run, it upserts rather than duplicating.
//
// Run with: npx tsx prisma/load-phase3a-competency-framework.ts
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/db";

const SPREADSHEET_ID = "104JCOyEnRDzM7YJrDuSsPCBI4ZQzsj21EQxOXn_4Sgs";
const SOURCE_DOC_NUMBER = "IK-HC-00-04";
const SOURCE_DOC_DATE = new Date("2025-10-31T00:00:00.000Z");
const REVISION = "00";
const SOURCE_LINK = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

// COM-18: "Create stable codes and a reviewed alias map for spelling/
// duplicate variants such as Innitiavite/Initiative, Adaptibility/
// Adaptability, Troubleshooting variants and TPM variants." The source sheet
// itself has no separate alias column, so known typos are corrected here by
// hand, with the raw source spelling preserved in aliasesCsv for the
// historical migration's row-matching (COM-19).
const NAME_CORRECTIONS: Record<string, { correctedName: string; aliases: string[] }> = {
  Innitiavite: { correctedName: "Initiative", aliases: ["Innitiavite", "Initiative"] },
  Adaptibility: { correctedName: "Adaptability", aliases: ["Adaptibility", "Adaptability"] },
};

function slugToCode(prefix: string, name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return `${prefix}_${slug}`;
}

interface ParsedLevelRow {
  subCategory: string;
  competencyName: string;
  description: string;
  level: number;
  indicatorText: string;
}

// LI- General / LI- Work / LI-Leadership share the same 5-column merged-cell
// shape: Sub Category | Competency | Description | Proficiency Level |
// Behaviour Indicator. Excel's merged cells export as blank strings on every
// row after the first in a block, so blank Sub Category/Competency/
// Description cells are forward-filled from the prior row.
function parseLevelSheet(sheet: XLSX.WorkSheet): ParsedLevelRow[] {
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const headerRowIndex = rows.findIndex((r) => /sub ?category/i.test(String(r[0] ?? "")));
  if (headerRowIndex === -1) return [];

  const parsed: ParsedLevelRow[] = [];
  let lastSubCategory = "";
  let lastCompetencyName = "";
  let lastDescription = "";

  for (const row of rows.slice(headerRowIndex + 1)) {
    const [rawSubCategory, rawCompetencyName, rawDescription, rawLevel, rawIndicator] = row;
    const subCategory = String(rawSubCategory ?? "").trim() || lastSubCategory;
    const competencyName = String(rawCompetencyName ?? "").trim() || lastCompetencyName;
    const description = String(rawDescription ?? "").trim() || lastDescription;
    const levelMatch = String(rawLevel ?? "").match(/(\d)/);
    const indicatorText = String(rawIndicator ?? "").trim();

    if (!subCategory || !competencyName || !levelMatch || !indicatorText) continue;

    lastSubCategory = subCategory;
    lastCompetencyName = competencyName;
    lastDescription = description;

    parsed.push({ subCategory, competencyName, description, level: Number(levelMatch[1]), indicatorText });
  }
  return parsed;
}

interface ParsedCompetency {
  category: "GENERAL" | "WORK" | "LEADERSHIP";
  subCategory: string;
  name: string;
  description: string;
  levels: Map<number, string>;
}

function groupIntoCompetencies(category: "GENERAL" | "WORK" | "LEADERSHIP", rows: ParsedLevelRow[]): ParsedCompetency[] {
  const byName = new Map<string, ParsedCompetency>();
  for (const row of rows) {
    const key = `${row.subCategory}::${row.competencyName}`;
    let entry = byName.get(key);
    if (!entry) {
      entry = { category, subCategory: row.subCategory, name: row.competencyName, description: row.description, levels: new Map() };
      byName.set(key, entry);
    }
    entry.levels.set(row.level, row.indicatorText);
  }
  return [...byName.values()];
}

interface ParsedCompanyValue {
  order: number;
  name: string;
  weight: number;
  scoreIndicators: Map<number, string[]>;
}

// Tata Nilai: No | Nilai-nilai perusahaan | Bobot | 0 | 25 | 50 | 75 | 100 —
// each value spans several rows (multiple behavioural bullets per score);
// merged/blank leading cells are forward-filled the same way, and every
// score column's bullets across a value's row-block are joined into one
// indicator (newline-separated) rather than picking only the first.
function parseCompanyValuesSheet(sheet: XLSX.WorkSheet): ParsedCompanyValue[] {
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const headerRowIndex = rows.findIndex((r) => /nilai-nilai perusahaan/i.test(String(r[1] ?? "")));
  if (headerRowIndex === -1) return [];

  const SCORE_COLUMNS = [
    { score: 0, col: 3 },
    { score: 25, col: 4 },
    { score: 50, col: 5 },
    { score: 75, col: 6 },
    { score: 100, col: 7 },
  ];

  const values: ParsedCompanyValue[] = [];
  let current: ParsedCompanyValue | null = null;

  for (const row of rows.slice(headerRowIndex + 1)) {
    const no = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();
    const weight = String(row[2] ?? "").trim();

    if (no && name) {
      current = { order: Number(no), name, weight: Number(weight) || 20, scoreIndicators: new Map() };
      values.push(current);
    }
    if (!current) continue;

    for (const { score, col } of SCORE_COLUMNS) {
      const text = String(row[col] ?? "").trim();
      if (!text) continue;
      const existing = current.scoreIndicators.get(score) ?? [];
      existing.push(text);
      current.scoreIndicators.set(score, existing);
    }
  }
  return values;
}

async function main() {
  console.log(`Fetching Competency Matrix workbook (${SPREADSHEET_ID})...`);
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`);
  if (!res.ok) throw new Error(`Failed to fetch workbook: ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const generalRows = parseLevelSheet(workbook.Sheets["LI- General"]);
  const workRows = parseLevelSheet(workbook.Sheets["LI- Work"]);
  const leadershipRows = parseLevelSheet(workbook.Sheets["LI-Leadership"]);
  const companyValueRows = parseCompanyValuesSheet(workbook.Sheets["Tata Nilai"]);

  const competencies: ParsedCompetency[] = [
    ...groupIntoCompetencies("GENERAL", generalRows),
    ...groupIntoCompetencies("WORK", workRows),
    ...groupIntoCompetencies("LEADERSHIP", leadershipRows),
  ];

  console.log(
    `Parsed ${competencies.length} competencies (${generalRows.length ? "General" : ""} rows) and ${companyValueRows.length} Company Values.`
  );
  if (competencies.length === 0 || companyValueRows.length !== 5) {
    throw new Error(
      `Sanity check failed: expected >0 competencies and exactly 5 Company Values, got ${competencies.length} / ${companyValueRows.length}. Aborting without writing.`
    );
  }

  await prisma.$transaction(async (tx) => {
    const competencyFrameworkVersion = await tx.competencyFrameworkVersion.upsert({
      where: { id: `phase3a-competency-${SOURCE_DOC_NUMBER}-rev${REVISION}` },
      update: {},
      create: {
        id: `phase3a-competency-${SOURCE_DOC_NUMBER}-rev${REVISION}`,
        versionLabel: `${SOURCE_DOC_NUMBER} Rev ${REVISION}`,
        sourceDocNumber: SOURCE_DOC_NUMBER,
        sourceDocDate: SOURCE_DOC_DATE,
        effectiveFrom: SOURCE_DOC_DATE,
        status: "ACTIVE",
      },
    });

    const usedCodes = new Set<string>();
    let displayOrder = 0;
    for (const c of competencies) {
      const correction = NAME_CORRECTIONS[c.name];
      const name = correction?.correctedName ?? c.name;
      let code = slugToCode(c.category.slice(0, 3), name);
      while (usedCodes.has(code)) code = `${code}_${displayOrder}`;
      usedCodes.add(code);

      const definition = await tx.competencyDefinition.upsert({
        where: { frameworkVersionId_code: { frameworkVersionId: competencyFrameworkVersion.id, code } },
        update: {
          category: c.category,
          subcategory: c.subCategory,
          name,
          description: c.description || null,
          aliasesCsv: correction?.aliases.join(",") ?? null,
          displayOrder: displayOrder++,
        },
        create: {
          frameworkVersionId: competencyFrameworkVersion.id,
          code,
          category: c.category,
          subcategory: c.subCategory,
          name,
          description: c.description || null,
          aliasesCsv: correction?.aliases.join(",") ?? null,
          displayOrder: displayOrder++,
        },
      });

      for (const [level, indicatorText] of c.levels.entries()) {
        await tx.competencyLevelIndicator.upsert({
          where: { competencyDefinitionId_level: { competencyDefinitionId: definition.id, level } },
          update: { indicatorText },
          create: { competencyDefinitionId: definition.id, level, indicatorText },
        });
      }
    }

    const companyValueFrameworkVersion = await tx.companyValueFrameworkVersion.upsert({
      where: { id: `phase3a-company-values-${SOURCE_DOC_NUMBER}-rev${REVISION}` },
      update: {},
      create: {
        id: `phase3a-company-values-${SOURCE_DOC_NUMBER}-rev${REVISION}`,
        versionLabel: `${SOURCE_DOC_NUMBER} Rev ${REVISION} (Tata Nilai)`,
        sourceDocNumber: SOURCE_DOC_NUMBER,
        sourceDocDate: SOURCE_DOC_DATE,
        effectiveFrom: SOURCE_DOC_DATE,
        status: "ACTIVE",
      },
    });

    for (const v of companyValueRows) {
      const code = slugToCode("VAL", v.name);
      const definition = await tx.companyValueDefinition.upsert({
        where: { frameworkVersionId_code: { frameworkVersionId: companyValueFrameworkVersion.id, code } },
        update: { name: v.name, weight: v.weight, displayOrder: v.order },
        create: { frameworkVersionId: companyValueFrameworkVersion.id, code, name: v.name, weight: v.weight, displayOrder: v.order },
      });

      for (const [score, bullets] of v.scoreIndicators.entries()) {
        const indicatorText = bullets.join("\n");
        await tx.companyValueRubricIndicator.upsert({
          where: { companyValueDefinitionId_score: { companyValueDefinitionId: definition.id, score } },
          update: { indicatorText },
          create: { companyValueDefinitionId: definition.id, score, indicatorText },
        });
      }
    }

    console.log(`Loaded ${competencies.length} competencies and ${companyValueRows.length} Company Values.`);
    console.log(`Source: ${SOURCE_LINK}`);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
