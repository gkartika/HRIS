"use client";

import { startTransition, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { setJobTestAction } from "./actions";

type FormAction = (prev: string | undefined, formData: FormData) => Promise<string | undefined>;

const primary = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60";

// One form for every settings screen: runs the (already bound) server action, keeps what
// was typed when it fails, says "Tersimpan" when it works, and can empty itself after an add.
export function ActionForm({
  action,
  submitLabel,
  children,
  resetOnSuccess = false,
  className = "space-y-3",
}: {
  action: FormAction;
  submitLabel: string;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        setSaved(false);
        setPending(true);
        startTransition(async () => {
          const message = await action(undefined, data);
          setPending(false);
          if (message) {
            setError(message);
            return;
          }
          setSaved(true);
          if (resetOnSuccess) ref.current?.reset();
          router.refresh();
        });
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Menyimpan..." : submitLabel}
        </button>
        {error && <span className="text-xs text-rose-600">{error}</span>}
        {saved && !error && !pending && <span className="text-xs text-emerald-700">Tersimpan.</span>}
      </div>
    </form>
  );
}

// A button that runs an action after a "Yakin?" step and shows the error if it refuses.
export function ConfirmAction({
  label,
  confirmLabel,
  action,
  className,
}: {
  label: string;
  confirmLabel?: string;
  action: () => Promise<string | undefined>;
  className?: string;
}) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <ConfirmButton
        label={label}
        confirmLabel={confirmLabel}
        pending={pending}
        className={className}
        onConfirm={() =>
          run(async () => {
            setError(null);
            const message = await action();
            if (message) setError(message);
            else router.refresh();
          })
        }
      />
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}

// A plain button (no confirmation), e.g. activate / deactivate.
export function RunButton({ label, action, className = "text-xs text-indigo-600 hover:underline" }: { label: string; action: () => Promise<string | undefined>; className?: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className={`${className} disabled:opacity-60`}
        onClick={() =>
          run(async () => {
            setError(null);
            const message = await action();
            if (message) setError(message);
            else router.refresh();
          })
        }
      >
        {pending ? "…" : label}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}

// Tick a test on or off for a job title; saves at once.
export function JobTestToggle({ jobId, testTypeId, checked, label }: { jobId: string; testTypeId: string; checked: boolean; label: string }) {
  const [value, setValue] = useState(checked);
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        aria-label={label}
        checked={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setValue(next);
          setError(null);
          run(async () => {
            const message = await setJobTestAction(jobId, testTypeId, next);
            if (message) {
              setValue(!next);
              setError(message);
            }
          });
        }}
      />
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}

// Placeholders that fill themselves into the invitation messages.
export function TemplatePreview({ initialEmail, initialWa }: { initialEmail: string; initialWa: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [wa, setWa] = useState(initialWa);
  const sample = { nama: "Rina Maharani", posisi: "Operator Produksi", tanggal: "Senin, 26 Oktober 2026", jam: "09.00 WIB", lokasi: "Ruang Meeting HR" };
  const fill = (tpl: string) => tpl.replace(/\{(nama|posisi|tanggal|jam|lokasi)\}/gi, (_m, k: string) => sample[k.toLowerCase() as keyof typeof sample]);
  const area = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
  const lab = "mb-1 block text-xs text-slate-500";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className={lab} htmlFor="tpl-email">Pesan email ke pelamar</label>
        <textarea id="tpl-email" name="invitationEmailTemplate" rows={6} value={email} onChange={(e) => setEmail(e.target.value)} className={area} />
        <p className="mt-2 text-xs text-slate-500">Contoh hasilnya:</p>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{fill(email)}</p>
      </div>
      <div>
        <label className={lab} htmlFor="tpl-wa">Pesan WhatsApp ke pelamar</label>
        <textarea id="tpl-wa" name="invitationWaTemplate" rows={6} value={wa} onChange={(e) => setWa(e.target.value)} className={area} />
        <p className="mt-2 text-xs text-slate-500">Contoh hasilnya:</p>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{fill(wa)}</p>
      </div>
    </div>
  );
}
