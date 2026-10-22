"use client";

import { useState } from "react";
import { DocumentFileInput } from "@/components/document-file-input";
import { formatMobile, mobileProblem, normalizeMobile } from "@/lib/mobile-number";

// Two uploads travel in one request that may not exceed 4.5 MB, so each is limited to 2 MB.
const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

// The contact and document fields every application asks for, external or internal: email, WhatsApp number
// (typed any way, kept in one standard form), the newest CV (required) and one supporting document (optional).
// The same fields and rules in both forms; only the look differs (passed in as classes).
export function ApplicantContactFields({
  defaultEmail = "",
  defaultMobile = "",
  inputClass,
  labelClass,
  hintClass,
  prefilledNote,
}: {
  defaultEmail?: string;
  defaultMobile?: string;
  inputClass: string;
  labelClass: string;
  hintClass: string;
  /** Shown under email and WhatsApp when they were filled from the employee profile. */
  prefilledNote?: string;
}) {
  const [mobile, setMobile] = useState(defaultMobile);
  const typed = mobile.trim().length > 0;
  const problem = typed ? mobileProblem(mobile) : null;
  const accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

  return (
    <>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} className={inputClass} />
        <p className={hintClass}>{prefilledNote && defaultEmail ? prefilledNote : "Undangan interview dan surat penawaran dikirim ke email ini."}</p>
      </div>
      <div>
        <label htmlFor="mobileNumber" className={labelClass}>
          Nomor WhatsApp
        </label>
        <input
          id="mobileNumber"
          name="mobileNumber"
          type="tel"
          required
          autoComplete="tel"
          placeholder="0812 3456 7890"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          aria-invalid={!!problem}
          aria-describedby="mobile-hint"
          className={inputClass}
        />
        <p id="mobile-hint" className={problem ? "mt-1 text-xs text-rose-700" : typed ? "mt-1 text-xs text-emerald-700" : hintClass}>
          {problem ? (
            problem
          ) : typed ? (
            <>
              Akan disimpan sebagai <b>{formatMobile(normalizeMobile(mobile))}</b>
              {prefilledNote && mobile === defaultMobile ? " · terisi dari profil" : ""}
            </>
          ) : (
            "Boleh ditulis dengan 0, +62, atau 62, dengan spasi atau tanda hubung."
          )}
        </p>
      </div>
      <div>
        <label htmlFor="cv" className={labelClass}>
          CV terbaru <span className="text-rose-600">*</span>
        </label>
        <DocumentFileInput id="cv" name="cv" required accept={accept} maxBytes={UPLOAD_MAX_BYTES} className="block w-full text-sm" />
        <p className={hintClass}>Unggah CV yang paling baru. PDF, Word, atau foto JPG/PNG, maksimal 2 MB.</p>
      </div>
      <div>
        <label htmlFor="supporting" className={labelClass}>
          Dokumen pendukung <span className="text-xs font-normal opacity-70">(opsional)</span>
        </label>
        <DocumentFileInput id="supporting" name="supporting" accept={accept} maxBytes={UPLOAD_MAX_BYTES} className="block w-full text-sm" />
        <p className={hintClass}>Satu berkas saja, maksimal 2 MB: ijazah, sertifikat, atau portofolio. Kalau ada beberapa, gabungkan jadi satu PDF.</p>
      </div>
    </>
  );
}
