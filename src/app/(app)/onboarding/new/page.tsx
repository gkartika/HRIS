import { requireSession } from "@/lib/require-session";
import { canCreateOnboardingCase } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateOnboardingForm } from "./create-onboarding-form";

export default async function NewOnboardingCasePage() {
  const session = await requireSession();
  if (!canCreateOnboardingCase(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  // Only employees without one yet — OnboardingCase.employeeId is @unique,
  // so this keeps the picker itself from offering a doomed selection.
  const employees = await prisma.employee.findMany({
    where: { activeFlag: true, onboardingCase: null },
    orderBy: { fullLegalName: "asc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("onboarding.newCase")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("onboarding.newCaseSubtitle")}</p>
      <div className="mt-4 max-w-lg">
        <CreateOnboardingForm employees={employees} />
      </div>
    </div>
  );
}
