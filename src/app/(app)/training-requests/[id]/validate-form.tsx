"use client";

import { useActionState } from "react";
import Link from "next/link";
import { validateTrainingRequest } from "../actions";
import { t } from "@/lib/i18n/id";

interface CourseOption {
  id: string;
  title: string;
}

export function ValidateForm({ requestId, courses }: { requestId: string; courses: CourseOption[] }) {
  const [error, formAction, isPending] = useActionState(validateTrainingRequest.bind(null, requestId), undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      {courses.length === 0 ? (
        <p className="text-sm text-slate-400">
          Belum ada Pelatihan (Training Course) —{" "}
          <Link href="/training/courses" className="text-indigo-600 hover:underline">
            tambah pelatihan
          </Link>{" "}
          terlebih dahulu.
        </p>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.courseLabel")}</label>
            <select name="courseId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih Pelatihan —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.validateNoteLabel")}</label>
            <textarea name="note" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isPending ? "Memvalidasi..." : t("trainingRequest.validateButton")}
          </button>
        </>
      )}
    </form>
  );
}
