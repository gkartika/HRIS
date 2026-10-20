"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { executeMovementRequest } from "@/app/(app)/movements/actions";

// Carries out an approved Perubahan Posisi for an internal applicant: the employee moves to
// the new position. Runs the same action as the button on the movement page.
export function ExecuteMovementButton({ movementRequestId }: { movementRequestId: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3 rounded-lg bg-emerald-50 p-4">
      <p className="text-sm text-emerald-900">Perubahan Posisi sudah disetujui. Laksanakan untuk memindahkan karyawan ke posisi barunya.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ConfirmButton
          label="Pindahkan karyawan"
          confirmLabel="Ya, pindahkan sekarang"
          pending={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onConfirm={() =>
            run(async () => {
              setError(null);
              const message = await executeMovementRequest(movementRequestId);
              if (message) setError(message);
              else router.refresh();
            })
          }
        />
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
      <p className="mt-2 text-[11px] text-emerald-800">Jika tanggal efektifnya di masa depan, perpindahan terjadwal dan berlaku otomatis pada harinya.</p>
    </div>
  );
}
