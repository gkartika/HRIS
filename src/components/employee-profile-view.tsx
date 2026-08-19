import { t } from "@/lib/i18n/id";
import { deriveEmployeeLifecycleStatus } from "@/lib/employee-lifecycle";
import type { Employee, Assignment, Position, Job, OrgUnit, FileObject } from "@/generated/prisma/client";

const LIFECYCLE_BADGE_TONE: Record<string, string> = {
  AKAN_MASUK: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  OUT: "bg-rose-50 text-rose-700",
};

type AssignmentWithPosition = Assignment & {
  position: Position & { job: Job; orgUnit: OrgUnit };
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (value === undefined) return null;
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-900">{value || "—"}</p>
    </div>
  );
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(date));
}

const ASSIGNMENT_BADGE_TONE: Record<string, string> = {
  PRIMARY: "bg-indigo-50 text-indigo-700",
  ADDITIONAL: "bg-emerald-50 text-emerald-700",
  ACTING: "bg-amber-50 text-amber-700",
  TEMPORARY: "bg-slate-100 text-slate-600",
};

export function EmployeeProfileView({
  employee,
  assignments,
  files = [],
  educationLevelLabel,
  ptkpLabel,
  reportsTo,
}: {
  employee: Partial<Employee>;
  assignments: AssignmentWithPosition[];
  files?: FileObject[];
  educationLevelLabel?: string | null;
  ptkpLabel?: string | null;
  reportsTo?: { label: string; holderName: string | null } | null;
}) {
  const lifecycleStatus =
    employee.activeFlag !== undefined && employee.hireDate
      ? deriveEmployeeLifecycleStatus(employee.activeFlag, new Date(employee.hireDate))
      : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-slate-900">
              {employee.fullLegalName}
            </h1>
            <p className="font-mono text-xs text-slate-400">{employee.employeeNumber}</p>
          </div>
          <div className="flex gap-2">
            {lifecycleStatus && (
              <span className={`rounded-md px-2 py-1 text-xs font-medium ${LIFECYCLE_BADGE_TONE[lifecycleStatus]}`}>
                {t(`employeeLifecycleStatus.${lifecycleStatus}`)}
              </span>
            )}
            {employee.employmentStatus && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {t(`employmentStatus.${employee.employmentStatus}`)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label={t("employee.fullLegalName")} value={employee.fullLegalName} />
          <Field
            label={t("employee.gender")}
            value={employee.gender ? t(`gender.${employee.gender}`) : undefined}
          />
          <Field label={t("employee.birthPlace")} value={employee.birthPlace} />
          <Field label={t("employee.birthDate")} value={formatDate(employee.birthDate)} />
          <Field label={t("employee.workEmail")} value={employee.workEmail} />
          <Field label={t("employee.personalEmail")} value={employee.personalEmail} />
          <Field label={t("employee.mobileNumber")} value={employee.mobileNumber} />
          <Field label={t("employee.currentAddress")} value={employee.currentAddress} />
          <Field label={t("employee.hireDate")} value={formatDate(employee.hireDate)} />
          {educationLevelLabel !== undefined && (
            <Field label="Pendidikan Terakhir" value={educationLevelLabel} />
          )}
          {employee.nationalIdNumber !== undefined && (
            <Field label="NIK (KTP)" value={employee.nationalIdNumber} />
          )}
          {employee.noKk !== undefined && <Field label="No. KK" value={employee.noKk} />}
          {employee.namaIbuKandung !== undefined && (
            <Field label="Nama Ibu Kandung" value={employee.namaIbuKandung} />
          )}
          {ptkpLabel !== undefined && <Field label="PTKP Pajak" value={ptkpLabel} />}
          {employee.bankAccountNumber !== undefined && (
            <Field label="No. Rekening Bank" value={employee.bankAccountNumber} />
          )}
          {employee.taxId !== undefined && <Field label="NPWP" value={employee.taxId} />}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-medium text-slate-900">{t("assignmentUi.title")}</h2>
        {reportsTo !== undefined && (
          <p className="mt-1 text-xs text-slate-500">
            {t("assignmentUi.reportsTo")}:{" "}
            {reportsTo ? `${reportsTo.label}${reportsTo.holderName ? ` — ${reportsTo.holderName}` : ""}` : "—"}
          </p>
        )}
        {assignments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">{t("employee.noPosition")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {a.position.jobLevel} {a.position.job.jobTitle}
                  </p>
                  <p className="text-xs text-slate-500">{a.position.orgUnit.unitName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t("assignmentUi.effectiveFrom")} {formatDate(a.effectiveFrom)}
                    {" — "}
                    {a.effectiveTo ? formatDate(a.effectiveTo) : t("assignmentUi.ongoing")}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-medium ${ASSIGNMENT_BADGE_TONE[a.assignmentType]}`}
                >
                  {t(`assignmentType.${a.assignmentType}`)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-medium text-slate-900">Dokumen</h2>
          <div className="mt-3 space-y-2">
            {files.map((f) => (
              <a
                key={f.id}
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2 text-sm text-indigo-600 hover:bg-slate-50"
              >
                <span>{f.originalFileName}</span>
                <span className="text-xs text-slate-400">{f.category}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
