import { AccessDenied } from "@/components/access-denied";
import { SettingsTabs } from "../settings-tabs";
import { formatDateMedium } from "@/lib/format";
import { Fragment } from "react";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { TypeQuotaRowForm } from "./type-quota-row-form";
import { NewTypeForm } from "./new-type-form";
import { ApproverRowForm, type PositionOption } from "./approver-row-form";
import { QuotaOverrideRowForm } from "./quota-override-row-form";
import { AddQuotaOverrideForm } from "./add-quota-override-form";
import { WorkScheduleRowForm } from "./work-schedule-row-form";
import { HolidayBulkForm } from "./holiday-bulk-form";
import { DeleteHolidayButton } from "./delete-holiday-button";
import { UnarchiveTypeButton } from "./unarchive-type-button";
import type { OrgUnit } from "@/generated/prisma/client";

const UNIT_TYPE_LABELS: Record<string, string> = {
  DEPARTMENT: "Departemen",
  SECTION: "Seksi",
  GROUP: "Grup",
  TEAM: "Tim",
};

// Any OrgUnit tier (Departemen/Seksi/Grup/Tim) can have its own approver
// row — renders the whole tree, indenting each level under its parent, so
// HR Admin can configure an approver as granularly as the org chart goes,
// not just at Department level. See resolveAbsenceApprovalChain
// (absence-routing.ts) for how a chain picks the 2 closest configured
// tiers to a given employee.
function OrgUnitApproverRows({
  unit,
  depth,
  childrenByParentId,
  positionOptions,
  configByOrgUnitId,
}: {
  unit: OrgUnit;
  depth: number;
  childrenByParentId: Map<string, OrgUnit[]>;
  positionOptions: PositionOption[];
  configByOrgUnitId: Map<string, { approverPositionId: string; requiresSecondStage: boolean }>;
}) {
  const children = childrenByParentId.get(unit.id) ?? [];
  const config = configByOrgUnitId.get(unit.id);
  return (
    <Fragment>
      <tr className={`border-t border-slate-100 ${depth > 0 ? "bg-slate-50/50" : ""}`}>
        <td className={depth === 0 ? "px-4 py-3 font-medium text-slate-900" : "px-4 py-3 text-slate-600"} style={{ paddingLeft: `${16 + depth * 20}px` }}>
          {depth > 0 && "↳ "}
          {unit.unitName}
          <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">{UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType}</span>
        </td>
        <td className="px-4 py-3">
          <ApproverRowForm
            orgUnitId={unit.id}
            positions={positionOptions}
            currentApproverPositionId={config?.approverPositionId ?? null}
            currentRequiresSecondStage={config?.requiresSecondStage ?? false}
          />
        </td>
      </tr>
      {children.map((child) => (
        <OrgUnitApproverRows
          key={child.id}
          unit={child}
          depth={depth + 1}
          childrenByParentId={childrenByParentId}
          positionOptions={positionOptions}
          configByOrgUnitId={configByOrgUnitId}
        />
      ))}
    </Fragment>
  );
}

const TAB_TITLES: Record<string, string> = {
  jenis: "Jenis Absensi & Jatah Default",
  penyetuju: "Penyetuju per Unit Organisasi",
  jatah: "Jatah per Karyawan",
  libur: "Libur & Jadwal Kerja",
};
const TABS = ["jenis", "penyetuju", "jatah", "libur"] as const;
type Tab = (typeof TABS)[number];

export default async function AbsenceSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.find((x) => x === tabParam) ?? "jenis";
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) {
    return <AccessDenied />;
  }

  // One query for every type (active + archived), split in memory below —
  // was two separate round trips for what's ultimately the same small
  // table read twice with complementary filters.
  const [allTypes, entitlements, orgUnits, positions, approverConfigs, overrides, employees, workSchedule, companyHolidays] = await Promise.all([
    prisma.absenceTypeConfig.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.absenceEntitlementConfig.findMany(),
    // Every OrgUnit, any tier — Department, Section, Group, or Team can
    // each have their own approver row (see resolveAbsenceApprovalChain,
    // absence-routing.ts, which picks the 2 closest configured tiers to a
    // given employee). Rendered as a tree below, indented by depth.
    prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } }),
    prisma.position.findMany({
      where: { archived: false },
      select: { id: true, jobLevel: true, job: { select: { jobTitle: true } }, orgUnit: { select: { unitName: true } } },
      orderBy: { positionCode: "asc" },
    }),
    prisma.absenceApproverConfig.findMany(),
    prisma.absenceQuotaOverride.findMany({
      include: {
        employee: { select: { employeeNumber: true, fullLegalName: true } },
        absenceType: { select: { label: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.employee.findMany({
      where: { activeFlag: true },
      orderBy: { fullLegalName: "asc" },
      select: { id: true, employeeNumber: true, fullLegalName: true },
    }),
    prisma.workScheduleConfig.findMany(),
    prisma.companyHoliday.findMany({ orderBy: { date: "asc" } }),
  ]);

  const rootOrgUnits = orgUnits.filter((u) => !u.parentUnitId);
  const childrenByParentId = new Map<string, typeof orgUnits>();
  for (const u of orgUnits) {
    if (u.parentUnitId) {
      const list = childrenByParentId.get(u.parentUnitId) ?? [];
      list.push(u);
      childrenByParentId.set(u.parentUnitId, list);
    }
  }

  const types = allTypes.filter((tp) => !tp.archived);
  const archivedTypes = allTypes.filter((tp) => tp.archived).sort((a, b) => a.label.localeCompare(b.label));

  const annualDaysByType = new Map(entitlements.map((e) => [e.absenceTypeCode, e.annualDays]));
  const typeQuotaRows = types.map((tp) => ({
    code: tp.code,
    label: tp.label,
    requiresFirstApproval: tp.requiresFirstApproval,
    activeFlag: tp.activeFlag,
    annualDays: annualDaysByType.get(tp.code) ?? null,
    employeeRequestable: tp.employeeRequestable,
    pointsWeight: tp.pointsWeight,
    countsTowardTdl: tp.countsTowardTdl,
    hoursMultiplier: tp.hoursMultiplier,
  }));

  const SHIFT_LABELS: Record<string, string> = { SHIFT_1: "Shift 1", SHIFT_2: "Shift 2", SHIFT_3: "Shift 3", NON_SHIFT: "Libur" };
  const minutesByShiftDay = new Map(workSchedule.map((s) => [`${s.shiftType}:${s.dayOfWeek}`, s.minutes]));
  const workScheduleRows = (["SHIFT_1", "SHIFT_2", "SHIFT_3", "NON_SHIFT"] as const).map((shiftType) => ({
    shiftType,
    shiftLabel: SHIFT_LABELS[shiftType],
    minutesByDay: Array.from({ length: 7 }, (_, day) => minutesByShiftDay.get(`${shiftType}:${day}`) ?? 0),
  }));

  const configByOrgUnitId = new Map(
    approverConfigs.map((c) => [c.orgUnitId, { approverPositionId: c.approverPositionId, requiresSecondStage: c.requiresSecondStage }])
  );
  const positionOptions = positions.map((p) => ({
    id: p.id,
    label: `${p.jobLevel} ${p.job.jobTitle} — ${p.orgUnit.unitName}`,
  }));

  const overrideRows = overrides.map((o) => ({
    employeeId: o.employeeId,
    employeeLabel: `${o.employee.employeeNumber} — ${o.employee.fullLegalName}`,
    absenceTypeCode: o.absenceTypeCode,
    absenceTypeLabel: o.absenceType.label,
    annualDays: o.annualDays,
    updatedAt: formatDateMedium(o.updatedAt),
  }));
  const employeeOptions = employees.map((e) => ({ id: e.id, label: `${e.employeeNumber} — ${e.fullLegalName}` }));
  const activeTypeOptions = types.filter((tp) => tp.activeFlag).map((tp) => ({ code: tp.code, label: tp.label }));

  return (
    <div className="space-y-8">
      <div>
        <SettingsTabs groupId="absensi" current={`/admin/absence-settings?tab=${tab}`} />
        <h1 className="text-lg font-medium text-slate-900">{TAB_TITLES[tab]}</h1>
      </div>

      {tab === "jenis" && (
        <section>
          <h2 className="text-sm font-medium text-slate-900">Jenis Absensi, Alur Persetujuan & Jatah Default</h2>
          <p className="mt-1 text-xs text-slate-500">
            &quot;Perlu Penyetuju Pertama&quot; menentukan apakah jenis ini melalui tahap Penyetuju Pertama sebelum HR Admin
            (mis. Sakit biasanya tidak). Persetujuan HR Admin selalu menjadi tahap akhir wajib. Jatah Tahunan Default:
            kosongkan untuk tidak dibatasi (dievaluasi kasus per kasus), isi 0 jika jenis ini tidak diberikan secara
            default (mis. Cuti — lalu atur jatah per orang lewat Override Jatah per Karyawan di bawah).
          </p>
          <div className="mt-3 space-y-3">
            {typeQuotaRows.map((row) => (
              <TypeQuotaRowForm key={row.code} row={row} />
            ))}
            {typeQuotaRows.length === 0 && <p className="text-sm text-slate-400">Belum ada jenis Absensi.</p>}
          </div>
          <div className="mt-3">
            <NewTypeForm />
          </div>
        </section>
      )}

      {tab === "jenis" && archivedTypes.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-900">Jenis Absensi Diarsipkan</h2>
          <p className="mt-1 text-xs text-slate-500">
            Tidak muncul di daftar di atas atau di manapun dalam aplikasi — riwayat lama yang masih memakainya tetap
            utuh. Batalkan arsip untuk memunculkannya kembali.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {archivedTypes.map((tp) => (
                  <tr key={tp.code} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{tp.code}</td>
                    <td className="px-4 py-2.5">{tp.label}</td>
                    <td className="px-4 py-2.5 text-right">
                      <UnarchiveTypeButton code={tp.code} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "penyetuju" && (
        <section>
          <h2 className="text-sm font-medium text-slate-900">Penyetuju per Unit Organisasi</h2>
          <p className="mt-1 text-xs text-slate-500">
            Departemen, Seksi, Grup, atau Tim — semuanya bisa diberi satu Posisi penyetuju sendiri, untuk jenis Absensi
            yang memerlukannya. Unit yang dibiarkan kosong otomatis memakai penyetuju dari unit induk di atasnya.
            Centang &quot;Teruskan ke unit induk&quot; jika karyawan di unit ini perlu melalui DUA tahap (unit ini, lalu
            unit induk terdekat yang juga punya penyetuju) — biarkan tidak tercentang untuk satu tahap saja, meskipun
            unit induknya sendiri punya penyetuju (unit induk itu tetap dipakai langsung oleh karyawan yang berada di
            unit induk itu sendiri, bukan otomatis jadi tahap ke-2 untuk unit-unit di bawahnya).
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Unit Organisasi</th>
                  <th className="px-4 py-3 font-medium">Penyetuju</th>
                </tr>
              </thead>
              <tbody>
                {rootOrgUnits.map((u) => (
                  <OrgUnitApproverRows
                    key={u.id}
                    unit={u}
                    depth={0}
                    childrenByParentId={childrenByParentId}
                    positionOptions={positionOptions}
                    configByOrgUnitId={configByOrgUnitId}
                  />
                ))}
              </tbody>
            </table>
            {rootOrgUnits.length === 0 && <p className="p-4 text-sm text-slate-400">Belum ada Unit Organisasi.</p>}
          </div>
        </section>
      )}

      {tab === "jatah" && (
        <section>
          <h2 className="text-sm font-medium text-slate-900">Override Jatah per Karyawan</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pengecualian jatah tahunan untuk karyawan tertentu, di luar jatah default perusahaan di atas. Kosongkan
            jumlah hari pada baris yang sudah ada untuk menghapus override tersebut.
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            {overrideRows.map((row) => (
              <QuotaOverrideRowForm key={`${row.employeeId}:${row.absenceTypeCode}`} row={row} />
            ))}
            {overrideRows.length === 0 && <p className="text-sm text-slate-400">Belum ada override jatah.</p>}
          </div>
          <div className="mt-3">
            <AddQuotaOverrideForm employees={employeeOptions} absenceTypes={activeTypeOptions} />
          </div>
        </section>
      )}

      {tab === "libur" && (
        <section>
          <h2 className="text-sm font-medium text-slate-900">Jadwal Jam Kerja per Shift</h2>
          <p className="mt-1 text-xs text-slate-500">
            Menit kerja terjadwal per hari, per Shift — sumber perhitungan Total Jam Kerja di Rekonsiliasi Absensi. 0 =
            hari libur untuk Shift tersebut.
          </p>
          <div className="mt-3 space-y-3">
            {workScheduleRows.map((row) => (
              <WorkScheduleRowForm key={row.shiftType} row={row} />
            ))}
          </div>
        </section>
      )}

      {tab === "libur" && (
        <section>
          <h2 className="text-sm font-medium text-slate-900">Kalender Hari Libur</h2>
          <p className="mt-1 text-xs text-slate-500">
            Tempel sekaligus satu tahun Tanggal Merah nasional atau Cuti Bersama — setiap karyawan aktif otomatis
            terisi untuk tanggal tersebut, tanpa perlu diklasifikasikan satu per satu di Rekonsiliasi Absensi. Hari
            yang sudah punya klasifikasi lain (Absensi, override shift, atau Masuk) tidak akan ditimpa.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <HolidayBulkForm
              holidayType="TANGGAL_MERAH"
              title="Tanggal Merah (Libur Nasional)"
              placeholder={"2026-01-01 Tahun Baru Masehi\n2026-08-17 Hari Kemerdekaan RI"}
            />
            <HolidayBulkForm
              holidayType="CUTI_BERSAMA"
              title="Cuti Bersama"
              placeholder={"2026-04-20 Cuti Bersama Idul Fitri\n2026-04-21 Cuti Bersama Idul Fitri"}
            />
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Jenis</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {companyHolidays.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs">{formatDateMedium(h.date)}</td>
                    <td className="px-4 py-2.5">{h.label}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          h.holidayType === "CUTI_BERSAMA" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {h.holidayType === "CUTI_BERSAMA" ? "Cuti Bersama" : "Tanggal Merah"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DeleteHolidayButton id={h.id} />
                    </td>
                  </tr>
                ))}
                {companyHolidays.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-400" colSpan={4}>
                      Belum ada tanggal yang dikonfigurasi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
