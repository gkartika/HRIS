import { t } from "@/lib/i18n/id";
import { averageMatrixScores, isMatrixScores, performanceSummary, tataNilaiAverage, type EvaluationMatrixScores, type MatrixDefinition } from "@/lib/evaluation";

// The final result of an evaluation, for Admin SDM (also while an evaluator is still missing) and the Department
// Head (once completed). Two big numbers (performance, tata nilai), then one table per section with a column per
// evaluator and, when there are two, the average.
export interface EvaluatorResult {
  slot: "P1" | "P2";
  name: string;
  submitted: boolean;
  scores: unknown;
}

const fmt = (n: number) => String(n).replace(".", ",");

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-[7px] overflow-hidden rounded-full bg-slate-200" role="presentation">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

function Cell({ value, max, highlight }: { value: number | null; max: number; highlight?: boolean }) {
  if (value === null) return <span className="block rounded-md bg-slate-50 px-2 py-1.5 text-center text-xs text-slate-400">{t("evaluation.matrix.notSent")}</span>;
  const pct = (value / max) * 100;
  return (
    <span
      className="block rounded-md px-2 py-1.5 text-right"
      style={{ background: `linear-gradient(90deg, ${highlight ? "#c7d2fe" : "#e8ebf5"} ${pct}%, transparent ${pct}%)` }}
    >
      <b className="text-slate-900">{fmt(value)}</b>
    </span>
  );
}

function CompareTable({
  title,
  criteria,
  max,
  columns,
  footer,
}: {
  title: string;
  criteria: { key: string; label: string }[];
  max: number;
  columns: { name: string; values: (number | null)[]; final?: boolean; foot: string }[];
  footer: string;
}) {
  const grid = { gridTemplateColumns: `minmax(0,1.7fr) repeat(${columns.length}, minmax(0,1fr))` };
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-2 overflow-x-auto">
        <div className="min-w-[480px] text-[13.5px]">
          <div className="grid gap-2 pb-1 text-xs font-bold text-slate-500" style={grid}>
            <span>{t("evaluation.matrix.criteria")}</span>
            {columns.map((c) => (
              <span key={c.name} className={c.final ? "text-indigo-700" : ""}>
                {c.name}
              </span>
            ))}
          </div>
          {criteria.map(({ key, label }, i) => (
            <div key={key} className="grid items-center gap-2 border-t border-slate-100 py-1.5" style={grid}>
              <span className="text-slate-800">{label}</span>
              {columns.map((c) => (
                <Cell key={c.name} value={c.values[i]} max={max} highlight={c.final} />
              ))}
            </div>
          ))}
          <div className="grid items-center gap-2 border-t-2 border-slate-200 pt-2 font-bold text-slate-900" style={grid}>
            <span>{footer}</span>
            {columns.map((c) => (
              <span key={c.name} className="px-2 text-right">
                {c.foot}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function EvaluationResultView({ evaluators, attendance, definition }: { evaluators: EvaluatorResult[]; attendance: React.ReactNode; definition: MatrixDefinition }) {
  const submitted = evaluators.filter((e) => e.submitted);
  const matrices = submitted.map((e) => e.scores).filter(isMatrixScores) as EvaluationMatrixScores[];
  // the result of an evaluation: the average of everyone who submitted (one person: their own grades)
  const final = averageMatrixScores(matrices, definition);
  if (!final || matrices.length !== submitted.length) return null; // older evaluations are shown by the caller
  const missing = evaluators.filter((e) => !e.submitted);
  const provisional = missing.length > 0;
  const perf = performanceSummary(final, definition);
  const tata = tataNilaiAverage(final, definition);
  const two = evaluators.length > 1;

  const perfColumn = (e: EvaluatorResult) => {
    const s = e.submitted && isMatrixScores(e.scores) ? e.scores : null;
    return { name: `${e.slot} · ${e.name}`, values: definition.performance.map((c) => (s ? s.performance[c.key] ?? null : null)), foot: s ? fmt(performanceSummary(s, definition).total) : "—" };
  };
  const tataColumn = (e: EvaluatorResult) => {
    const s = e.submitted && isMatrixScores(e.scores) ? e.scores : null;
    return { name: `${e.slot} · ${e.name}`, values: definition.tataNilai.map((c) => (s ? s.tataNilai[c.key] ?? null : null)), foot: s ? fmt(tataNilaiAverage(s, definition)) : "—" };
  };
  const caption = provisional ? ` (${t("evaluation.matrix.provisional")}, ${submitted.map((e) => e.slot).join(" & ")})` : two ? ` (${t("evaluation.matrix.averageOf")})` : "";

  return (
    <div className="space-y-4">
      {provisional && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("evaluation.matrix.waitingFor", { names: missing.map((e) => `${e.slot} · ${e.name}`).join(", ") })}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className={`rounded-xl border bg-white p-4 ${provisional ? "border-dashed border-amber-400" : "border-slate-200"}`}>
          <p className="text-sm text-slate-600">
            {t("evaluation.matrix.performanceName")}
            {caption}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">
            {fmt(perf.total)} <span className="text-sm font-semibold text-slate-500">/ {perf.max}</span>
          </p>
          <div className="mt-2">
            <Bar pct={perf.percent} color="#4f46e5" />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{t("evaluation.matrix.ofMax", { percent: fmt(perf.percent) })}</p>
        </div>
        <div className={`rounded-xl border bg-white p-4 ${provisional ? "border-dashed border-amber-400" : "border-slate-200"}`}>
          <p className="text-sm text-slate-600">
            {t("evaluation.matrix.tataNilaiAverage")}
            {caption}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{fmt(tata)}</p>
          <div className="mt-2">
            <Bar pct={tata} color="#0d9488" />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{t("evaluation.matrix.scaleNote")}</p>
        </div>
      </div>

      <CompareTable
        title={t("evaluation.matrix.performanceName")}
        criteria={definition.performance}
        max={8}
        columns={[
          ...evaluators.map(perfColumn),
          ...(two && !provisional ? [{ name: t("evaluation.matrix.average"), values: definition.performance.map((c) => final.performance[c.key]), final: true, foot: fmt(perf.total) }] : []),
        ]}
        footer={t("evaluation.matrix.totalOf", { max: perf.max })}
      />
      <CompareTable
        title={t("evaluation.matrix.tataNilaiName")}
        criteria={definition.tataNilai}
        max={100}
        columns={[
          ...evaluators.map(tataColumn),
          ...(two && !provisional ? [{ name: t("evaluation.matrix.average"), values: definition.tataNilai.map((c) => final.tataNilai[c.key]), final: true, foot: fmt(tata) }] : []),
        ]}
        footer={t("evaluation.matrix.averageRow")}
      />
      {attendance}
    </div>
  );
}
