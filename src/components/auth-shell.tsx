import Image from "next/image";
import { t } from "@/lib/i18n/id";

// Shared frame for the pre-login pages (login, forgot password, set password).
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbf8fc] px-5 py-10">
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-auto w-full"
        viewBox="0 0 800 140"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 140 V80 L120 30 L230 85 L360 20 L500 90 L640 40 L800 95 V140Z" fill="rgba(85,44,89,.05)" />
        <path d="M0 140 V110 L90 78 L200 118 L330 70 L470 120 L600 80 L720 118 L800 96 V140Z" fill="rgba(85,44,89,.09)" />
      </svg>
      <div className="relative z-10 w-full max-w-[380px]">
        <div className="mb-5 h-[5px] w-12 rounded-full bg-brand-accent ring-1 ring-brand/20" />
        <Image src="/logo-cbp.png" alt={t("app.company")} width={180} height={57} priority className="h-auto w-[180px]" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-brand">{t("app.name")}</p>
        {children}
        <p className="mt-9 text-xs text-[#8a7e92]">
          Manajemen Karyawan, Pengembangan Organisasi, dan Urusan Umum
          <br />
          <a href="https://www.ptcbp.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
            www.ptcbp.com
          </a>
        </p>
      </div>
    </div>
  );
}

export const authInputClass =
  "w-full border-0 border-b-2 border-[#cfc4d6] bg-transparent px-0.5 py-3 text-[15px] text-[#231a28] placeholder:text-[#a79cb0] focus:border-brand focus:outline-none";
export const authLabelClass = "mb-1 block text-[13px] font-semibold text-[#4a3e52]";
export const authButtonClass =
  "w-full rounded-full bg-brand px-4 py-3 text-[15px] font-bold text-white transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-progress disabled:opacity-60";
export const authLinkClass = "font-semibold text-brand hover:underline";
