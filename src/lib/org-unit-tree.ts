// Pure, in-memory walk over the OrgUnit tree (Department -> Section -> Group
// -> Team). Callers load the whole (small) OrgUnit table once and resolve
// every employee's Department/Group from it, instead of the per-employee
// database walk that level3-scope.ts's resolveOrgUnitAncestorChain does —
// that one is right for a single lookup, wrong for a list of ~190 people.
// No Prisma imports, so it is unit testable with plain values.

export type OrgUnitKind = "DEPARTMENT" | "SECTION" | "GROUP" | "TEAM";

export interface OrgUnitNode {
  id: string;
  unitName: string;
  unitType: OrgUnitKind;
  parentUnitId: string | null;
}

export interface OrgUnitTree {
  /** The unit itself, then each ancestor up to the root, closest first. */
  ancestorChain(orgUnitId: string): OrgUnitNode[];
  /** Nearest DEPARTMENT at or above this unit, or null. */
  departmentOf(orgUnitId: string): OrgUnitNode | null;
  /** Nearest GROUP at or above this unit, or null (e.g. seat sits directly on a Section). */
  groupOf(orgUnitId: string): OrgUnitNode | null;
}

export function buildOrgUnitTree(units: OrgUnitNode[]): OrgUnitTree {
  const byId = new Map(units.map((u) => [u.id, u]));

  function ancestorChain(orgUnitId: string): OrgUnitNode[] {
    const chain: OrgUnitNode[] = [];
    const seen = new Set<string>();
    let current = byId.get(orgUnitId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.push(current);
      current = current.parentUnitId ? byId.get(current.parentUnitId) : undefined;
    }
    return chain;
  }

  const nearest = (orgUnitId: string, kind: OrgUnitKind) =>
    ancestorChain(orgUnitId).find((u) => u.unitType === kind) ?? null;

  return {
    ancestorChain,
    departmentOf: (id) => nearest(id, "DEPARTMENT"),
    groupOf: (id) => nearest(id, "GROUP"),
  };
}
