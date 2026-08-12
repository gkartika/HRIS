"use client";

import { useActionState, useState } from "react";
import { createMandatoryTrainingRule } from "./actions";

interface Option {
  id: string;
  label: string;
}

export function CreateRuleForm({
  courses,
  employees,
  departments,
  jobs,
  positions,
}: {
  courses: { id: string; title: string }[];
  employees: { id: string; employeeNumber: string; fullLegalName: string }[];
  departments: { id: string; unitName: string }[];
  jobs: { id: string; jobTitle: string }[];
  positions: { id: string; positionCode: string; job: { jobTitle: string } }[];
}) {
  const [error, formAction, isPending] = useActionState(createMandatoryTrainingRule, undefined);
  const [targetType, setTargetType] = useState("EVERYONE");

  const employeeOptions: Option[] = employees.map((e) => ({ id: e.id, label: `${e.employeeNumber} — ${e.fullLegalName}` }));
  const departmentOptions: Option[] = departments.map((d) => ({ id: d.id, label: d.unitName }));
  const jobOptions: Option[] = jobs.map((j) => ({ id: j.id, label: j.jobTitle }));
  const positionOptions: Option[] = positions.map((p) => ({ id: p.id, label: `${p.positionCode} — ${p.job.jobTitle}` }));

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-3">
      {error && <p className="md:col-span-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Pelatihan</label>
        <select name="courseId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis Target</label>
        <select
          name="targetType"
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="EVERYONE">Semua Karyawan</option>
          <option value="DEPARTMENT">Departemen</option>
          <option value="JOB">Jabatan Standar</option>
          <option value="PRIMARY_POSITION">Posisi Utama</option>
          <option value="EMPLOYEE">Karyawan Tertentu</option>
        </select>
      </div>
      <div>
        {targetType === "EMPLOYEE" && (
          <>
            <label className="mb-1 block text-xs text-slate-500">Karyawan</label>
            <select name="targetEmployeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              {employeeOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        )}
        {targetType === "DEPARTMENT" && (
          <>
            <label className="mb-1 block text-xs text-slate-500">Departemen</label>
            <select name="targetDepartmentId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              {departmentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        )}
        {targetType === "JOB" && (
          <>
            <label className="mb-1 block text-xs text-slate-500">Jabatan Standar</label>
            <select name="targetJobId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              {jobOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        )}
        {targetType === "PRIMARY_POSITION" && (
          <>
            <label className="mb-1 block text-xs text-slate-500">Posisi</label>
            <select name="targetPositionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              {positionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="md:col-span-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah Aturan"}
        </button>
      </div>
    </form>
  );
}
