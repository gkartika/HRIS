import { requireSession } from "@/lib/require-session";
import { GapTable } from "./gap-table";
import { isTrainingAdmin } from "@/lib/permissions";
import { getLevel3DepartmentIds, resolveDepartmentId } from "@/lib/level3-scope";
import { getActiveDirectorCandidates } from "@/lib/org-chart";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

// COM-10: "For each cycle, provide Department employee gap reports to that
// Department's Level 3 Position. Provide the gap report for Level 3
// employees to the Director." Both sections read from the same cycle
// snapshot — no live recomputation against current org data (COM-17).
export default async function CompetencyGapsPage({ searchParams }: { searchParams: Promise<{ cycleId?: string }> }) {
  const session = await requireSession();
  const { cycleId: requestedCycleId } = await searchParams;

  const isAdmin = isTrainingAdmin(session);
  const level3DepartmentIds = isAdmin ? [] : await getLevel3DepartmentIds(session.user.employeeId);
  const directorCandidates = isAdmin ? [] : await getActiveDirectorCandidates();
  const isDirector = directorCandidates.some((c) => c.employeeId === session.user.employeeId);

  if (!isAdmin && level3DepartmentIds.length === 0 && !isDirector) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const cycles = await prisma.competencyAssessmentCycle.findMany({
    where: { isHistorical: false },
    orderBy: { openedAt: "desc" },
    select: { id: true, cycleCode: true, periodLabel: true, status: true },
  });
  const cycleId = requestedCycleId ?? cycles[0]?.id;

  if (!cycleId) {
    return <p className="text-sm text-slate-400">Belum ada siklus penilaian.</p>;
  }

  const assessments = await prisma.competencyAssessment.findMany({
    where: { cycleId },
    include: {
      employee: { select: { fullLegalName: true, employeeNumber: true } },
      position: { select: { job: { select: { jobTitle: true } }, orgUnit: { select: { id: true, unitName: true } } } },
    },
    orderBy: { employee: { fullLegalName: "asc" } },
  });

  // Resolve each assessment's Department (a Position's orgUnit may be a
  // Section under a Department — same walk-up as level3-scope.ts).
  const deptCache = new Map<string, string | null>();
  async function departmentIdFor(orgUnitId: string): Promise<string | null> {
    if (!deptCache.has(orgUnitId)) {
      deptCache.set(orgUnitId, await resolveDepartmentId(orgUnitId));
    }
    return deptCache.get(orgUnitId) ?? null;
  }

  const departmentSection: typeof assessments = [];
  if (isAdmin || level3DepartmentIds.length > 0) {
    for (const a of assessments) {
      if (a.isLevel3AtSnapshot) continue; // Level 3 employees are reported to the Director instead
      if (!a.position) continue;
      const deptId = await departmentIdFor(a.position.orgUnit.id);
      if (isAdmin || (deptId && level3DepartmentIds.includes(deptId))) departmentSection.push(a);
    }
  }

  const directorSection = isAdmin || isDirector ? assessments.filter((a) => a.isLevel3AtSnapshot) : [];

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Laporan Gap Kompetensi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Gap Kompetensi = level yang disyaratkan dikurangi level aktual (COM-07). Laporan ini menampilkan hasil siklus yang
        sudah dibekukan (snapshot) — perubahan Kerangka Kompetensi setelah siklus dibuka tidak mengubah data ini.
      </p>

      <form className="mt-4 flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Siklus</label>
          <select name="cycleId" defaultValue={cycleId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.periodLabel} ({c.cycleCode}) — {c.status}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("common.applyFilter")}
        </button>
        <a
          href={`/api/competency/gaps/export?cycleId=${cycleId}`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Ekspor CSV
        </a>
      </form>

      {(isAdmin || level3DepartmentIds.length > 0) && (
        <GapTable rows={departmentSection} title="Gap Karyawan Departemen (untuk Level 3)" />
      )}
      {(isAdmin || isDirector) && <GapTable rows={directorSection} title="Gap Karyawan Level 3 (untuk Direktur)" />}
    </div>
  );
}
