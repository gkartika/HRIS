import { t } from "@/lib/i18n/id";
import type { Employee, Assignment, Position, Job, OrgUnit } from "@/generated/prisma/client";

type AssignmentWithPosition = Assignment & {
  position: Position & { job: Job; orgUnit: OrgUnit };
};

export function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (value === undefined) return null;
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-900">{value || "—"}</p>
    </div>
  );
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(date));
}

export function formatAddress(parts: {
  line?: string | null;
  rtRw?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): string | null {
  const rtRw = parts.rtRw ? `RT/RW ${parts.rtRw}` : null;
  const segments = [parts.line, rtRw, parts.village, parts.district, parts.city, parts.postalCode].filter(
    (segment): segment is string => Boolean(segment)
  );
  return segments.length > 0 ? segments.join(", ") : null;
}

const ASSIGNMENT_BADGE_TONE: Record<string, string> = {
  PRIMARY: "bg-indigo-50 text-indigo-700",
  ADDITIONAL: "bg-emerald-50 text-emerald-700",
  ACTING: "bg-amber-50 text-amber-700",
  TEMPORARY: "bg-slate-100 text-slate-600",
};

// Profil tab content: fields grouped by theme instead of one flat grid, so
// the dozen-plus fields HR Admin can see don't read as an undifferentiated
// wall. Kepegawaian/Bank/Pajak is collapsed by default — HR-Admin-only data
// (per projectEmployee's `!== undefined` gating below) that's rarely the
// reason someone opens this page.
export function EmployeeProfileFields({
  employee,
  educationLevelLabel,
  ptkpLabel,
}: {
  employee: Partial<Employee>;
  educationLevelLabel?: string | null;
  ptkpLabel?: string | null;
}) {
  const birthPlaceDate = [employee.birthPlace, employee.birthDate ? formatDate(employee.birthDate) : null]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Identitas</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label={t("employee.fullLegalName")} value={employee.fullLegalName} />
          <Field label={t("employee.gender")} value={employee.gender ? t(`gender.${employee.gender}`) : undefined} />
          <Field label="Tempat, Tanggal Lahir" value={birthPlaceDate || undefined} />
          {educationLevelLabel !== undefined && <Field label="Pendidikan Terakhir" value={educationLevelLabel} />}
          {employee.nationalIdNumber !== undefined && <Field label="NIK (KTP)" value={employee.nationalIdNumber} />}
          {employee.noKk !== undefined && <Field label="No. KK" value={employee.noKk} />}
          {employee.namaIbuKandung !== undefined && (
            <Field label="Nama Ibu Kandung" value={employee.namaIbuKandung} />
          )}
          {ptkpLabel !== undefined && <Field label="PTKP Pajak" value={ptkpLabel} />}
        </div>
      </section>

      <section className="border-t border-slate-100 pt-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Kontak &amp; Alamat</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("employee.personalEmail")} value={employee.personalEmail} />
          <Field label={t("employee.mobileNumber")} value={employee.mobileNumber} />
          {employee.currentAddressLine !== undefined && (
            <Field
              label={t("employee.currentAddressTitle")}
              value={formatAddress({
                line: employee.currentAddressLine,
                rtRw: employee.currentAddressRtRw,
                village: employee.currentAddressVillage,
                district: employee.currentAddressDistrict,
                city: employee.currentAddressCity,
                postalCode: employee.currentAddressPostalCode,
              })}
            />
          )}
          {employee.idCardAddressSameAsCurrent !== undefined && (
            <Field
              label={t("employee.idCardAddressTitle")}
              value={
                employee.idCardAddressSameAsCurrent
                  ? t("employee.idCardAddressSameAsCurrent")
                  : formatAddress({
                      line: employee.idCardAddressLine,
                      rtRw: employee.idCardAddressRtRw,
                      village: employee.idCardAddressVillage,
                      district: employee.idCardAddressDistrict,
                      city: employee.idCardAddressCity,
                      postalCode: employee.idCardAddressPostalCode,
                    })
              }
            />
          )}
        </div>
      </section>

      {(employee.emergencyContactName !== undefined ||
        employee.emergencyContactRelation !== undefined ||
        employee.emergencyContactPhone !== undefined) && (
        <section className="border-t border-slate-100 pt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Kontak Darurat</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Nama" value={employee.emergencyContactName} />
            <Field label="Hubungan" value={employee.emergencyContactRelation} />
            <Field label="Nomor Telepon" value={employee.emergencyContactPhone} />
          </div>
        </section>
      )}

      {(employee.bankAccountName !== undefined ||
        employee.bankAccountNumber !== undefined ||
        employee.taxId !== undefined ||
        employee.bpjsEmploymentNumber !== undefined ||
        employee.bpjsHealthNumber !== undefined) && (
        <details className="group border-t border-slate-100 pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>
              Kepegawaian, Bank &amp; Pajak{" "}
              <span className="ml-1 normal-case text-slate-300">(khusus Admin SDM)</span>
            </span>
            <svg
              className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </summary>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label={t("employee.employeeNumber")} value={employee.employeeNumber} />
            <Field label={t("employee.hireDate")} value={formatDate(employee.hireDate)} />
            <Field label="Nama Pemilik Rekening" value={employee.bankAccountName} />
            <Field label="No. Rekening Bank" value={employee.bankAccountNumber} />
            <Field label="NPWP" value={employee.taxId} />
            <Field label="No. BPJS Ketenagakerjaan" value={employee.bpjsEmploymentNumber} />
            <Field label="No. BPJS Kesehatan" value={employee.bpjsHealthNumber} />
          </div>
        </details>
      )}
    </div>
  );
}

// Penempatan tab content: current assignment history, kept separate from
// the profile fields above since it moved to its own tab.
export function EmployeeAssignmentHistory({
  assignments,
  reportsTo,
  startDateEditor,
  scheduledAction,
  originLabels,
}: {
  assignments: AssignmentWithPosition[];
  /** How a placement came about (Rekrutmen eksternal, Rekrutmen internal, Mutasi), by assignment id. */
  originLabels?: Record<string, string>;
  reportsTo?: { label: string; holderName: string | null } | null;
  /** When given (HR admin), shown instead of the plain start date so it can be changed in place. */
  startDateEditor?: (assignment: AssignmentWithPosition) => React.ReactNode;
  /** When given (HR admin), shown under a scheduled (future-dated) placement, e.g. a cancel button. */
  scheduledAction?: (assignment: AssignmentWithPosition) => React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <h3 className="text-sm font-medium text-slate-900">{t("assignmentUi.title")}</h3>
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
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {a.position.jobLevel} {a.position.job.jobTitle}
                </p>
                <p className="text-xs text-slate-500">{a.position.orgUnit.unitName}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-slate-400">
                  {t("assignmentUi.effectiveFrom")} {startDateEditor ? startDateEditor(a) : formatDate(a.effectiveFrom)}
                  {" — "}
                  {a.effectiveTo ? formatDate(a.effectiveTo) : t("assignmentUi.ongoing")}
                </p>
                {originLabels?.[a.id] && <p className="mt-1 text-xs text-slate-500">Asal: {originLabels[a.id]}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${ASSIGNMENT_BADGE_TONE[a.assignmentType]}`}>
                  {t(`assignmentType.${a.assignmentType}`)}
                </span>
                {a.status === "SCHEDULED" && (
                  <>
                    <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      Dijadwalkan, berlaku {formatDate(a.effectiveFrom)}
                    </span>
                    {scheduledAction?.(a)}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
