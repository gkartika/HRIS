import Link from "next/link";
import { listOpenVacancies } from "@/lib/recruitment-service";
import { t } from "@/lib/i18n/id";

export const dynamic = "force-dynamic";

export default async function PublicVacanciesPage() {
  const vacancies = await listOpenVacancies("EXTERNAL");

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#231a28]">Lowongan Terbuka</h1>
      <p className="mt-1 text-sm text-[#6a5f72]">
        Pilih lowongan, lalu masukkan kode akses yang tertulis di iklan lowongan. Anda tidak perlu membuat akun.
      </p>

      {vacancies.length === 0 ? (
        <p className="mt-8 rounded-xl border border-[#e6dcea] bg-white p-6 text-sm text-[#6a5f72]">
          Saat ini belum ada lowongan yang dibuka. Silakan kembali lagi nanti.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {vacancies.map((v) => (
            <li key={v.id} className="rounded-xl border border-[#e6dcea] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#231a28]">{v.publicTitle || v.job?.jobTitle}</h2>
                  <p className="text-sm text-[#6a5f72]">
                    {v.department.unitName} · {t(`shiftCode.${v.shiftCode}`)}
                  </p>
                </div>
                <Link
                  href={`/cbp-recruitment/apply/${v.id}`}
                  className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark"
                >
                  Lamar
                </Link>
              </div>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-[#8a7e92]">Tentang pekerjaan</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-[#4a3e52]">{v.publicDescription}</p>
              {v.publicRequirements && (
                <>
                  <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-[#8a7e92]">Persyaratan</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-[#4a3e52]">{v.publicRequirements}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
