import { findOfferByToken, offerIsOpen } from "@/lib/recruitment-flow";
import { OfferResponse } from "./offer-response";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" });

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await findOfferByToken(token);

  if (!offer) {
    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
        <h1 className="text-lg font-bold text-[#231a28]">Tautan tidak berlaku</h1>
        <p className="mt-1 text-sm text-[#6a5f72]">Tautan surat penawaran ini sudah diganti, kedaluwarsa, atau tidak ditemukan. Hubungi HR PT CBP untuk tautan baru.</p>
      </div>
    );
  }

  const position = `${offer.candidate.request.job?.jobTitle ?? "Posisi"} · ${offer.candidate.request.department.unitName}`;
  const open = offerIsOpen(offer);
  const expired = !offer.response && !open;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#231a28]">Surat Penawaran Kerja</h1>
      <p className="mt-1 text-sm text-[#6a5f72]">
        Untuk {offer.candidate.fullName} · {position}
      </p>

      <div className="mt-5 rounded-xl border border-[#e6dcea] bg-white p-5">
        <p className="text-sm text-[#4a3e52]">
          Baca surat penawaran di bawah dengan teliti.{" "}
          <a href={`/api/recruitment/offer-file/${token}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
            Buka di tab baru
          </a>
          .
        </p>
        <iframe src={`/api/recruitment/offer-file/${token}`} title="Surat penawaran" className="mt-3 h-[520px] w-full rounded-lg border border-[#e6dcea]" />
        <div className="mt-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={offer.companySignature} alt="Tanda tangan perusahaan" className="h-16 rounded border border-[#eadfef] bg-white" />
          <p className="text-xs text-[#6a5f72]">Ditandatangani untuk PT Cahaya Bukit Perunggu pada {dateTime.format(offer.companySignedAt)}.</p>
        </div>
      </div>

      <div className="mt-5">
        {offer.response === "ACCEPTED" && (
          <div className="rounded-xl border border-[#bfe0cd] bg-[#e6f4ec] p-5 text-sm text-[#1d6b43]">
            Anda menerima penawaran ini pada {dateTime.format(offer.respondedAt ?? new Date())}. Tim HR akan menghubungi Anda untuk langkah berikutnya.
          </div>
        )}
        {offer.response === "DECLINED" && (
          <div className="rounded-xl border border-[#e6dcea] bg-white p-5 text-sm text-[#4a3e52]">
            Anda menolak penawaran ini pada {dateTime.format(offer.respondedAt ?? new Date())}. Terima kasih atas waktu Anda.
          </div>
        )}
        {expired && (
          <div className="rounded-xl border border-[#f3c1c6] bg-[#fdecee] p-5 text-sm text-[#a1252f]">
            Masa berlaku tautan ini sudah habis. Hubungi HR PT CBP jika Anda masih berminat.
          </div>
        )}
        {open && <OfferResponse token={token} />}
      </div>
    </div>
  );
}
