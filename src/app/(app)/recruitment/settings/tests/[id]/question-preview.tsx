import { ESSAY_MIN_CHARS, SCALE_LABELS } from "@/lib/recruitment-candidates";
import type { RecruitmentTestForm } from "@/generated/prisma/enums";

// How one question reads on the applicant's test page: the same fonts, line breaks and answer controls
// (see test-runner.tsx), so the recruiter sees the formatting before an applicant does. Nothing here is clickable.
export function QuestionPreview({
  form,
  monospace,
  prompt,
  options,
  label,
}: {
  form: RecruitmentTestForm;
  monospace: boolean;
  prompt: string;
  options: string[];
  /** "Soal 2 dari 4" */
  label: string;
}) {
  return (
    <div className="rounded-xl border border-[#e6dcea] bg-[#fbf8fc] p-4">
      <p className="text-xs font-bold text-brand">{label}</p>
      {prompt.trim() === "" ? (
        <p className="mt-1 text-sm text-slate-400">Tulis soal di sebelah kiri, hasilnya muncul di sini.</p>
      ) : (
        <p className={`mt-1 text-[15px] font-semibold text-[#231a28] ${monospace ? "whitespace-pre-wrap break-all font-mono text-[14px] leading-7" : "whitespace-pre-line"}`}>{prompt}</p>
      )}

      {form === "ESSAY" && <div className="mt-3 rounded-lg border border-dashed border-[#cfc4d6] bg-white px-3 py-6 text-center text-xs text-[#9a8fa2]">Kotak jawaban (minimal {ESSAY_MIN_CHARS} karakter)</div>}

      {form === "MULTIPLE_CHOICE" && (
        <div className="mt-3 space-y-2">
          {options.map((o, i) => (
            <div key={i} className="rounded-lg border-2 border-[#cfc4d6] bg-white px-4 py-2.5 text-left text-[15px] text-[#4a3e52]">
              {o}
            </div>
          ))}
        </div>
      )}

      {form === "SCALE" && (
        <div className="mt-3">
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <div key={v} className="rounded-lg border-2 border-[#cfc4d6] bg-white py-2 text-center text-base font-bold text-[#4a3e52]">
                {v}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-[#8a7e92]">
            <span>{SCALE_LABELS[0]}</span>
            <span>{SCALE_LABELS[4]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
