import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { canCreateManualEvaluation } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateManualEvaluationForm } from "../decision-forms";

// WF-19/LIF-14 note: HR Admin may create a Manual HR evaluation for other
// authorized needs, reusing the exact same shared Evaluation entity/workflow
// as Contract Renewal and Perubahan Posisi.
export default async function NewManualEvaluationPage() {
  const session = await requireSession();
  if (!canCreateManualEvaluation(session)) {
    return <AccessDenied />;
  }

  const employees = await prisma.employee.findMany({ orderBy: { fullLegalName: "asc" }, select: { id: true, fullLegalName: true, employeeNumber: true } });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("evaluation.createManualTitle")}</h1>
      <div className="mt-4 max-w-lg">
        <CreateManualEvaluationForm employees={employees} />
      </div>
    </div>
  );
}
