"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signature-pad";
import { respondOfferAction } from "../../actions";

export function OfferResponse({ token }: { token: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  async function respond(response: "ACCEPTED" | "DECLINED") {
    setBusy(true);
    setError(null);
    const res = await respondOfferAction(token, response, response === "ACCEPTED" ? signature : null);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-[#e6dcea] bg-white p-5">
      <h2 className="text-base font-bold text-[#231a28]">Jawaban Anda</h2>
      <p className="mt-1 text-sm text-[#4a3e52]">Jika menerima, gambar tanda tangan Anda lalu tekan Saya menerima. Jawaban tidak bisa diubah setelah dikirim.</p>
      <div className="mt-3">
        <SignaturePad name="candidateSignature" onChange={setSignature} />
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-[10px] border border-[#f3c1c6] bg-[#fdecee] px-3 py-2.5 text-[13.5px] text-[#a1252f]">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !signature}
          onClick={() => respond("ACCEPTED")}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Mengirim..." : "Saya menerima"}
        </button>
        {!confirmDecline ? (
          <button type="button" disabled={busy} onClick={() => setConfirmDecline(true)} className="rounded-full border border-[#cfc4d6] px-5 py-2.5 text-sm font-semibold text-[#a1252f] hover:bg-[#fdecee]">
            Saya menolak
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#fdecee] px-3 py-1.5 text-sm">
            <span className="font-semibold text-[#a1252f]">Yakin menolak?</span>
            <button type="button" disabled={busy} onClick={() => respond("DECLINED")} className="rounded-full bg-[#a1252f] px-3 py-1 text-xs font-bold text-white">
              Ya, tolak
            </button>
            <button type="button" onClick={() => setConfirmDecline(false)} className="text-xs text-[#6a5f72]">
              Batal
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
