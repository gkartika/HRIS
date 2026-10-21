import { t } from "@/lib/i18n/id";

// The attendance numbers Admin SDM filled in when releasing the evaluation. Shown to the evaluator (to help them
// grade) and in the final result. No hooks, so it works inside both server and client components.
export interface EvaluationAttendance {
  sakit: number | null;
  ijin: number | null;
  alpha: number | null;
  ijinHalfDay: number | null;
}

export function AttendanceCard({ attendance, hint }: { attendance: EvaluationAttendance; hint?: boolean }) {
  const items: [string, number | null][] = [
    [t("evaluation.attendanceSakit"), attendance.sakit],
    [t("evaluation.attendanceIjin"), attendance.ijin],
    [t("evaluation.attendanceAlpha"), attendance.alpha],
    [t("evaluation.attendanceIjinHalfDay"), attendance.ijinHalfDay],
  ];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{t("evaluation.matrix.attendanceTitle")}</h3>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{t("evaluation.matrix.attendanceHint")}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            <p className="text-xl font-semibold text-slate-900">{value ?? "—"}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
