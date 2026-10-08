import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n/id";
import type { EducationLevel, PtkpStatus } from "@/generated/prisma/client";

// The fields the two "create employee" forms share (direct creation and
// "create from a recruitment request"). Only what is needed to create the record
// is always visible; everything else is tucked into EmployeeExtraFields and can
// be completed later from the employee's own detail page.
const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const LABEL = "mb-1 block text-xs text-slate-500";

export function EmployeeCoreFields({
  nextEmployeeNumber,
  hireDateHint = "(opsional)",
  hireDateDefault,
  leading,
}: {
  nextEmployeeNumber: string;
  hireDateHint?: string;
  hireDateDefault?: string;
  /** Extra field(s) shown first in the same grid (e.g. the position to fill). */
  leading?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {leading}
      <div>
        <label className={LABEL}>{t("employee.employeeNumber")}</label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-mono">{nextEmployeeNumber}</span>
          <span className="ml-2 text-xs text-slate-400">dibuat otomatis saat disimpan</span>
        </div>
      </div>
      <div>
        <label className={LABEL}>{t("employee.fullLegalName")}</label>
        <input name="fullLegalName" required className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>
          {t("employee.hireDate")} {hireDateHint}
        </label>
        <input name="hireDate" type="date" defaultValue={hireDateDefault} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>{t("employee.employmentStatus")}</label>
        <select name="employmentStatus" required className={INPUT}>
          <option value="">— Pilih —</option>
          <option value="PKWTT">{t("employmentStatus.PKWTT")}</option>
          <option value="PKWT">{t("employmentStatus.PKWT")}</option>
          <option value="HARIAN_LEPAS">{t("employmentStatus.HARIAN_LEPAS")}</option>
          <option value="MAGANG">{t("employmentStatus.MAGANG")}</option>
        </select>
      </div>
    </div>
  );
}

export function EmployeeExtraFields({
  educationLevels,
  ptkpStatuses,
  withNationalId = true,
}: {
  educationLevels: EducationLevel[];
  ptkpStatuses: PtkpStatus[];
  /** The recruitment path never asked for the KTP number; direct creation does. */
  withNationalId?: boolean;
}) {
  return (
    <details className="group mt-5 border-t border-slate-100 pt-4">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
        Data tambahan (opsional — bisa diisi nanti)
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL}>{t("employee.gender")}</label>
          <select name="gender" className={INPUT}>
            <option value="">— Pilih —</option>
            <option value="MALE">{t("gender.MALE")}</option>
            <option value="FEMALE">{t("gender.FEMALE")}</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>{t("employee.mobileNumber")}</label>
          <input name="mobileNumber" className={INPUT} />
        </div>
        {withNationalId && (
          <div>
            <label className={LABEL}>No. KTP (NIK)</label>
            <input name="nationalIdNumber" inputMode="numeric" maxLength={16} placeholder="16 digit angka" className={INPUT} />
          </div>
        )}
        <div>
          <label className={LABEL}>No. KK</label>
          <input name="noKk" inputMode="numeric" maxLength={16} placeholder="16 digit angka" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Nama Ibu Kandung</label>
          <input name="namaIbuKandung" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Pendidikan Terakhir</label>
          <select name="educationLevelId" className={INPUT}>
            <option value="">— Pilih —</option>
            {educationLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>PTKP Pajak</label>
          <select name="ptkpStatusCode" className={INPUT}>
            <option value="">— Pilih —</option>
            {ptkpStatuses.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </details>
  );
}
