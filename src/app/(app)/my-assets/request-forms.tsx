"use client";

import { useActionState, useState, startTransition, type ReactNode } from "react";
import { DocumentFileInput } from "@/components/document-file-input";
import { MIN_NEED_CHARS, MIN_REPORT_CHARS } from "@/lib/ga-request-rules";
import { submitMyRequest, type MyRequestKind, type MyRequestState } from "./actions";

const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const LABEL = "mb-1 block text-xs text-slate-500";

const COPY: Record<MyRequestKind, { title: string; hint: string; label: string; placeholder: string; submit: string; min: number }> = {
  NEED: {
    title: "Permintaan Aset Baru",
    hint: "Jelaskan aset yang Anda butuhkan. GA akan menindaklanjuti.",
    label: "Deskripsi kebutuhan",
    placeholder: "mis. monitor kedua 24 inci untuk pekerjaan desain",
    submit: "Kirim Permintaan",
    min: MIN_NEED_CHARS,
  },
  DAMAGE: {
    title: "Laporkan Kerusakan",
    hint: "",
    label: "Apa yang rusak dan bagaimana kejadiannya?",
    placeholder: "mis. layar berkedip sejak Senin, terjatuh dari meja",
    submit: "Kirim Laporan Kerusakan",
    min: MIN_REPORT_CHARS,
  },
  LOSS: {
    title: "Laporkan Kehilangan",
    hint: "",
    label: "Kronologi kehilangan (kapan, di mana, bagaimana)",
    placeholder: "mis. terakhir dipakai Selasa sore di area tambang, tidak ada saat dicek Rabu pagi",
    submit: "Kirim Laporan Kehilangan",
    min: MIN_REPORT_CHARS,
  },
};

// One form for the three requests. The values stay in the fields when the server says no.
function RequestForm({
  kind,
  assetId,
  assetSummary,
  onDone,
  onCancel,
}: {
  kind: MyRequestKind;
  assetId: string | null;
  assetSummary?: ReactNode;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const copy = COPY[kind];
  const [length, setLength] = useState(0);
  const [state, formAction, isPending] = useActionState<MyRequestState, FormData>(async (prev, formData) => {
    const result = await submitMyRequest(kind, assetId, prev, formData);
    if (result?.done) onDone(result.done);
    return result;
  }, undefined);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="mt-3 space-y-3 rounded-lg border border-indigo-200 bg-slate-50 p-4"
    >
      <p className="text-sm font-medium text-slate-900">{copy.title}</p>
      {copy.hint && <p className="text-xs text-slate-500">{copy.hint}</p>}
      {assetSummary}
      <div>
        <label className={LABEL}>{copy.label}</label>
        <textarea
          name="description"
          required
          rows={kind === "NEED" ? 3 : 4}
          placeholder={copy.placeholder}
          onChange={(e) => setLength(e.target.value.trim().length)}
          className={INPUT}
        />
        <p className={`mt-1 text-right text-xs ${length >= copy.min ? "text-emerald-700" : "text-slate-400"}`}>
          {length} / min. {copy.min} karakter
        </p>
      </div>
      {kind === "LOSS" && (
        <div>
          <label className={LABEL}>Perkiraan tanggal hilang</label>
          <input name="lostOn" type="date" className={`${INPUT} md:w-auto`} />
        </div>
      )}
      <div>
        <label className={LABEL}>Urgensi</label>
        <select name="urgency" defaultValue="MEDIUM" className={`${INPUT} md:w-auto`}>
          <option value="LOW">Rendah</option>
          <option value="MEDIUM">Sedang</option>
          <option value="HIGH">Tinggi</option>
        </select>
      </div>
      {kind !== "NEED" && (
        <div>
          <label className={LABEL}>Foto atau bukti (opsional)</label>
          <DocumentFileInput name="evidenceFile" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
        </div>
      )}
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${kind === "LOSS" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
        >
          {isPending ? "Mengirim..." : copy.submit}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Batal
        </button>
      </div>
    </form>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <p role="status" className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
      {message}
    </p>
  );
}

// Page title with the "Permintaan Aset" button on top; its form opens right under it.
export function PageHeader({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium text-slate-900">{title}</h1>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage("");
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Permintaan Aset
        </button>
      </div>
      {message && <Toast message={message} />}
      {open && (
        <RequestForm
          kind="NEED"
          assetId={null}
          onDone={(m) => {
            setMessage(m);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export interface HeldAsset {
  assetId: string;
  name: string;
  code: string;
  info: string;
  /** Set when the asset already has an open damage or loss report. */
  openReport: { label: string; status: string; number: string; tone: string } | null;
}

// A held asset with its two report buttons. The asset is already known, so the person only
// writes what happened. An asset with an open report shows its status instead of the buttons.
export function HeldAssetCard({ asset }: { asset: HeldAsset }) {
  const [open, setOpen] = useState<"DAMAGE" | "LOSS" | null>(null);
  const [message, setMessage] = useState("");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{asset.name}</p>
          <p className="font-mono text-xs text-slate-500">{asset.code}</p>
          <p className="mt-1 text-xs text-slate-500">{asset.info}</p>
        </div>
        {asset.openReport ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-xs font-medium ${asset.openReport.tone}`}>
              {asset.openReport.label} · {asset.openReport.status}
            </span>
            <span className="font-mono text-xs text-slate-400">{asset.openReport.number}</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen("DAMAGE");
                setMessage("");
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Lapor Rusak
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen("LOSS");
                setMessage("");
              }}
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              Lapor Hilang
            </button>
          </div>
        )}
      </div>
      {message && <div className="mt-3"><Toast message={message} /></div>}
      {open && !asset.openReport && (
        <RequestForm
          kind={open}
          assetId={asset.assetId}
          assetSummary={
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {asset.name} <span className="font-mono text-xs text-slate-400">{asset.code}</span>
            </p>
          }
          onDone={(m) => {
            setMessage(m);
            setOpen(null);
          }}
          onCancel={() => setOpen(null)}
        />
      )}
    </div>
  );
}
