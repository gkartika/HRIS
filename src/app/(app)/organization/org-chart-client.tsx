"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { stratify, tree, type HierarchyPointNode } from "d3-hierarchy";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { t } from "@/lib/i18n/id";
import { fetchOrgChartData } from "./actions";
import type { OrgChartData, OrgChartPosition } from "@/lib/org-chart";

const CARD_WIDTH = 220;
const CARD_HEIGHT = 96;
const NODE_SIZE_X = 260;
const NODE_SIZE_Y = 160;
const ROOT_ID = "__root__";

const ASSIGNMENT_BADGE_TONE: Record<string, string> = {
  PRIMARY: "bg-indigo-100 text-indigo-700",
  ADDITIONAL: "bg-emerald-100 text-emerald-700",
  ACTING: "bg-amber-100 text-amber-800",
  TEMPORARY: "bg-slate-200 text-slate-700",
};

interface FlatNode {
  id: string;
  parentId: string | null;
}

type PositionNode = HierarchyPointNode<FlatNode>;

function buildLayout(positions: OrgChartPosition[], collapsed: Set<string>) {
  // Hide descendants of collapsed nodes before laying out.
  const byId = new Map(positions.map((p) => [p.id, p]));
  const hidden = new Set<string>();
  function isDescendantOfCollapsed(pos: OrgChartPosition): boolean {
    let current: OrgChartPosition | undefined = pos;
    const seen = new Set<string>();
    while (current?.reportsToPositionId) {
      if (seen.has(current.id)) break; // guard against circular data
      seen.add(current.id);
      if (collapsed.has(current.reportsToPositionId)) return true;
      current = byId.get(current.reportsToPositionId);
    }
    return false;
  }
  for (const p of positions) {
    if (isDescendantOfCollapsed(p)) hidden.add(p.id);
  }

  const visible = positions.filter((p) => !hidden.has(p.id));
  const flat: FlatNode[] = [
    { id: ROOT_ID, parentId: null },
    ...visible.map((p) => ({
      id: p.id,
      parentId: p.reportsToPositionId && byId.has(p.reportsToPositionId) ? p.reportsToPositionId : ROOT_ID,
    })),
  ];

  const root = stratify<FlatNode>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(flat);

  const layout = tree<FlatNode>().nodeSize([NODE_SIZE_X, NODE_SIZE_Y]);
  const laidOut = layout(root);
  const nodes = laidOut.descendants().filter((n) => n.id !== ROOT_ID) as PositionNode[];
  const links = laidOut.links().filter((l) => l.source.id !== ROOT_ID);

  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  }
  if (nodes.length === 0) {
    minX = 0;
    maxX = 0;
    maxY = 0;
  }

  return { nodes, links, minX, maxX, maxY, hasHiddenChildren: (id: string) => collapsed.has(id) };
}

function positionHasChildren(positionId: string, allPositions: OrgChartPosition[]): boolean {
  return allPositions.some((p) => p.reportsToPositionId === positionId);
}

function PositionCard({
  position,
  isCollapsed,
  hasChildren,
  onToggleCollapse,
  onSelect,
  isDimmed,
  isSelected,
}: {
  position: OrgChartPosition;
  isCollapsed: boolean;
  hasChildren: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
  isDimmed: boolean;
  isSelected: boolean;
}) {
  const isVacant = position.occupants.length === 0;

  return (
    <div
      style={{ width: CARD_WIDTH }}
      onClick={onSelect}
      className={`relative cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-opacity ${
        isSelected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
      } ${isDimmed ? "opacity-30" : "opacity-100"}`}
    >
      <p className="truncate text-sm font-medium text-slate-900">{position.jobTitle}</p>
      <p className="truncate text-xs text-slate-500">
        {position.orgUnitName} · {position.jobLevel}
      </p>
      <div className="mt-2 space-y-1">
        {isVacant ? (
          <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            {t("positionStatus.VACANT")}
          </span>
        ) : (
          position.occupants.map((occ) => (
            <div key={occ.assignmentId} className="flex items-center justify-between gap-1">
              <span className="truncate text-xs text-slate-700">{occ.employeeName}</span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  ASSIGNMENT_BADGE_TONE[occ.assignmentType] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {t(`assignmentType.${occ.assignmentType}`)}
              </span>
            </div>
          ))
        )}
      </div>
      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="absolute -bottom-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </div>
  );
}

export function OrgChartClient({
  initialData,
  departments,
}: {
  initialData: OrgChartData;
  departments: { id: string; name: string }[];
}) {
  const [data, setData] = useState(initialData);
  const [asOfDate, setAsOfDate] = useState(initialData.asOfDate);
  const [department, setDepartment] = useState<string>("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 40, y: 40, k: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  // Derived rather than a separate state flag set synchronously in the
  // effect below — avoids a redundant render-then-render-again cascade.
  const isLoading = data.asOfDate !== asOfDate;

  useEffect(() => {
    let cancelled = false;
    fetchOrgChartData(asOfDate).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [asOfDate]);

  const { nodes, links, maxX, minX, maxY } = useMemo(
    () => buildLayout(data.positions, collapsed),
    [data.positions, collapsed]
  );

  const positionById = useMemo(() => new Map(data.positions.map((p) => [p.id, p])), [data.positions]);

  const matchesFilter = useCallback(
    (p: OrgChartPosition) => {
      if (department && p.orgUnitId !== department) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = p.occupants.some((o) => o.employeeName.toLowerCase().includes(q));
        const matchesJob = p.jobTitle.toLowerCase().includes(q);
        if (!matchesName && !matchesJob) return false;
      }
      return true;
    },
    [department, search]
  );

  const anyFilterActive = Boolean(department || search.trim());

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetView() {
    setTransform({ x: 40, y: 40, k: 1 });
  }

  function fitToScreen() {
    const container = containerRef.current;
    if (!container || nodes.length === 0) return;
    const treeWidth = maxX - minX + CARD_WIDTH + 80;
    const treeHeight = maxY + CARD_HEIGHT + 80;
    const scaleX = container.clientWidth / treeWidth;
    const scaleY = container.clientHeight / treeHeight;
    const k = Math.min(scaleX, scaleY, 1.2);
    setTransform({ x: 40 - minX * k + CARD_WIDTH / 2, y: 40, k });
  }

  function zoomBy(delta: number) {
    setTransform((prev) => ({ ...prev, k: Math.max(0.2, Math.min(2.5, prev.k + delta)) }));
  }

  function onMouseDown(e: React.MouseEvent) {
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: transform.x,
      origY: transform.y,
    };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setTransform((prev) => ({ ...prev, x: dragState.current!.origX + dx, y: dragState.current!.origY + dy }));
  }
  function onMouseUp() {
    dragState.current = null;
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.1 : -0.1);
  }

  const selectedPosition = selectedId ? positionById.get(selectedId) ?? null : null;
  const directReports = selectedPosition
    ? data.positions.filter((p) => p.reportsToPositionId === selectedPosition.id)
    : [];
  const reportsToPosition = selectedPosition?.reportsToPositionId
    ? positionById.get(selectedPosition.reportsToPositionId) ?? null
    : null;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Sebagai Tanggal</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Departemen</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Semua Departemen</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs text-slate-500">Cari Karyawan / Posisi</label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama atau jabatan..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => zoomBy(0.1)}
            title="Perbesar"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => zoomBy(-0.1)}
            title="Perkecil"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={fitToScreen}
            title="Sesuaikan ke layar"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <Maximize size={16} />
          </button>
          <button
            onClick={resetView}
            title="Atur ulang tampilan"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {data.structureWarnings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {data.structureWarnings.map((warning, i) => (
            <p
              key={i}
              className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700"
            >
              Peringatan struktur: {warning}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-4">
        <div
          ref={containerRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          className="relative h-[70vh] flex-1 cursor-grab overflow-hidden rounded-xl border border-slate-200 bg-slate-50 active:cursor-grabbing"
        >
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-slate-500">
              {t("common.loading")}
            </div>
          )}
          <div
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
              transformOrigin: "0 0",
              position: "absolute",
            }}
          >
            <svg
              className="pointer-events-none absolute overflow-visible"
              style={{ left: 0, top: 0 }}
            >
              {links.map((link, i) => {
                const s = link.source as PositionNode;
                const tgt = link.target as PositionNode;
                const sx = s.x + CARD_WIDTH / 2;
                const sy = s.y + CARD_HEIGHT;
                const tx = tgt.x + CARD_WIDTH / 2;
                const ty = tgt.y;
                const midY = (sy + ty) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                  />
                );
              })}
            </svg>
            {nodes.map((n) => {
              const nodeId = n.data.id;
              const position = positionById.get(nodeId);
              if (!position) return null;
              return (
                <div
                  key={nodeId}
                  className="absolute"
                  style={{ left: n.x, top: n.y }}
                >
                  <PositionCard
                    position={position}
                    isCollapsed={collapsed.has(nodeId)}
                    hasChildren={positionHasChildren(nodeId, data.positions)}
                    onToggleCollapse={() => toggleCollapse(nodeId)}
                    onSelect={() => setSelectedId(nodeId)}
                    isDimmed={anyFilterActive && !matchesFilter(position)}
                    isSelected={selectedId === nodeId}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {selectedPosition && (
          <div className="w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{selectedPosition.jobTitle}</p>
                <p className="font-mono text-xs text-slate-400">{selectedPosition.positionCode}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <p>
                <span className="text-slate-500">Unit: </span>
                {selectedPosition.orgUnitName}
              </p>
              <p>
                <span className="text-slate-500">Level: </span>
                {selectedPosition.jobLevel}
              </p>
              <p>
                <span className="text-slate-500">Jenis: </span>
                {selectedPosition.positionType}
              </p>
              <p>
                <span className="text-slate-500">Status: </span>
                {t(`positionStatus.${selectedPosition.positionStatus}`)}
              </p>
              <p>
                <span className="text-slate-500">Melapor ke: </span>
                {reportsToPosition ? reportsToPosition.jobTitle : "— puncak hierarki —"}
              </p>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-700">Pemegang Posisi</p>
              {selectedPosition.occupants.length === 0 ? (
                <p className="mt-1 text-xs text-slate-400">{t("positionStatus.VACANT")}</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {selectedPosition.occupants.map((o) => (
                    <li key={o.assignmentId} className="flex items-center justify-between text-xs">
                      <span>{o.employeeName}</span>
                      <span className="text-slate-400">{t(`assignmentType.${o.assignmentType}`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-700">
                Bawahan Langsung ({directReports.length})
              </p>
              {directReports.length === 0 ? (
                <p className="mt-1 text-xs text-slate-400">Tidak ada</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {directReports.map((r) => (
                    <li key={r.id} className="text-xs">
                      {r.jobTitle}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
