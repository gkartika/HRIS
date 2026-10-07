"use client";

import { useActionState, useState } from "react";
import { updateEmployee } from "../../actions";
import { t } from "@/lib/i18n/id";
import type { Employee, EducationLevel, PtkpStatus } from "@/generated/prisma/client";

export function EditEmployeeForm({
  employee,
  canEditLegalName,
  educationLevels,
  ptkpStatuses,
}: {
  employee: Employee;
  canEditLegalName: boolean;
  educationLevels: EducationLevel[];
  ptkpStatuses: PtkpStatus[];
}) {
  const action = updateEmployee.bind(null, employee.id);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const [sameAsCurrent, setSameAsCurrent] = useState(employee.idCardAddressSameAsCurrent ?? true);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.employeeNumber")}</label>
        <input
          value={employee.employeeNumber}
          disabled
          readOnly
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-400"
        />
        <p className="mt-1 text-[11px] text-slate-400">Dibuat otomatis dan tidak bisa diubah.</p>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <input
          name="fullLegalName"
          required
          defaultValue={employee.fullLegalName}
          disabled={!canEditLegalName}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.gender")}</label>
          <select
            name="gender"
            defaultValue={employee.gender ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">— Pilih —</option>
            <option value="MALE">{t("gender.MALE")}</option>
            <option value="FEMALE">{t("gender.FEMALE")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.birthPlace")}</label>
          <input
            name="birthPlace"
            defaultValue={employee.birthPlace ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.birthDate")}</label>
          <input
            name="birthDate"
            type="date"
            defaultValue={employee.birthDate ? new Date(employee.birthDate).toISOString().slice(0, 10) : ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.personalEmail")}</label>
        <input
          name="personalEmail"
          type="email"
          defaultValue={employee.personalEmail ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.mobileNumber")}</label>
        <input
          name="mobileNumber"
          defaultValue={employee.mobileNumber ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-medium text-slate-500">{t("employee.currentAddressTitle")}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("employee.currentAddressLine")}</label>
            <textarea
              name="currentAddressLine"
              rows={2}
              defaultValue={employee.currentAddressLine ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("employee.currentAddressRtRw")}</label>
              <input
                name="currentAddressRtRw"
                defaultValue={employee.currentAddressRtRw ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("employee.currentAddressCity")}</label>
              <input
                name="currentAddressCity"
                defaultValue={employee.currentAddressCity ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("employee.currentAddressDistrict")}</label>
              <input
                name="currentAddressDistrict"
                defaultValue={employee.currentAddressDistrict ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("employee.currentAddressVillage")}</label>
              <input
                name="currentAddressVillage"
                defaultValue={employee.currentAddressVillage ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("employee.currentAddressPostalCode")}</label>
              <input
                name="currentAddressPostalCode"
                defaultValue={employee.currentAddressPostalCode ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <label className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            name="idCardAddressSameAsCurrent"
            checked={sameAsCurrent}
            onChange={(e) => setSameAsCurrent(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-slate-600">{t("employee.idCardAddressSameAsCurrent")}</span>
        </label>

        {!sameAsCurrent && (
          <div className="mt-4 space-y-3 border-t border-dashed border-slate-200 pt-4">
            <p className="text-xs font-medium text-slate-500">{t("employee.idCardAddressTitle")}</p>
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("employee.idCardAddressLine")}</label>
              <textarea
                name="idCardAddressLine"
                rows={2}
                defaultValue={employee.idCardAddressLine ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">{t("employee.idCardAddressRtRw")}</label>
                <input
                  name="idCardAddressRtRw"
                  defaultValue={employee.idCardAddressRtRw ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">{t("employee.idCardAddressCity")}</label>
                <input
                  name="idCardAddressCity"
                  defaultValue={employee.idCardAddressCity ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">{t("employee.idCardAddressDistrict")}</label>
                <input
                  name="idCardAddressDistrict"
                  defaultValue={employee.idCardAddressDistrict ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">{t("employee.idCardAddressVillage")}</label>
                <input
                  name="idCardAddressVillage"
                  defaultValue={employee.idCardAddressVillage ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">{t("employee.idCardAddressPostalCode")}</label>
                <input
                  name="idCardAddressPostalCode"
                  defaultValue={employee.idCardAddressPostalCode ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Kontak Darurat — Nama</label>
          <input
            name="emergencyContactName"
            defaultValue={employee.emergencyContactName ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Hubungan</label>
          <input
            name="emergencyContactRelation"
            defaultValue={employee.emergencyContactRelation ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Nomor Telepon</label>
          <input
            name="emergencyContactPhone"
            defaultValue={employee.emergencyContactPhone ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {canEditLegalName && (
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-medium text-slate-500">Data Identitas &amp; Kependudukan</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">No. KTP (NIK)</label>
              <input
                name="nationalIdNumber"
                inputMode="numeric"
                maxLength={16}
                defaultValue={employee.nationalIdNumber ?? ""}
                placeholder="16 digit angka"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">No. KK</label>
              <input
                name="noKk"
                inputMode="numeric"
                maxLength={16}
                defaultValue={employee.noKk ?? ""}
                placeholder="16 digit angka"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Nama Ibu Kandung</label>
              <input
                name="namaIbuKandung"
                defaultValue={employee.namaIbuKandung ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Pendidikan Terakhir</label>
              <select
                name="educationLevelId"
                defaultValue={employee.educationLevelId ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Pilih —</option>
                {educationLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">PTKP Pajak</label>
              <select
                name="ptkpStatusCode"
                defaultValue={employee.ptkpStatusCode ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Pilih —</option>
                {ptkpStatuses.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Tanggal Bergabung (opsional)</label>
              <input
                name="hireDate"
                type="date"
                defaultValue={employee.hireDate ? new Date(employee.hireDate).toISOString().slice(0, 10) : ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}
      {canEditLegalName && (
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-medium text-slate-500">Data Bank, Pajak &amp; BPJS</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Nama Pemilik Rekening</label>
              <input
                name="bankAccountName"
                defaultValue={employee.bankAccountName ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Nomor Rekening Bank</label>
              <input
                name="bankAccountNumber"
                defaultValue={employee.bankAccountNumber ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">NPWP</label>
              <input
                name="taxId"
                defaultValue={employee.taxId ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">No. BPJS Ketenagakerjaan</label>
              <input
                name="bpjsEmploymentNumber"
                defaultValue={employee.bpjsEmploymentNumber ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">No. BPJS Kesehatan</label>
              <input
                name="bpjsHealthNumber"
                defaultValue={employee.bpjsHealthNumber ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("common.save")}
      </button>
    </form>
  );
}
