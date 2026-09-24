"use client";

import { useState, useTransition } from "react";
import { MailPlus } from "lucide-react";
import { inviteAllWithoutAccount } from "./[id]/account-actions";
import { ConfirmButton } from "@/components/confirm-button";

// Admin SDM: email an invitation to every active employee that has an Email
// Pribadi but no login yet. Two-step because it sends real email.
export function InviteAllButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <MailPlus size={14} className="text-slate-500" />
        <ConfirmButton
          label="Undang semua yang belum punya akun"
          confirmLabel="Ya, kirim undangan"
          pending={isPending}
          className="text-sm font-medium text-indigo-600 hover:underline"
          onConfirm={() =>
            startTransition(async () => {
              setResult(await inviteAllWithoutAccount());
            })
          }
        />
      </div>
      {result && (
        <p role="status" className={`max-w-md text-right text-xs ${result.ok ? "text-emerald-700" : "text-amber-700"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
