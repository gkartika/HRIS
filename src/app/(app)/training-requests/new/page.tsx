import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SubmitTrainingRequestForm } from "./submit-form";

export default async function NewTrainingRequestPage() {
  const session = await requireSession();
  if (!session.user.employeeId) {
    return <AccessDenied />;
  }

  const level3DepartmentIds = await getLevel3DepartmentIds(session.user.employeeId);
  const departmentEmployees =
    level3DepartmentIds.length > 0
      ? await prisma.employee.findMany({
          where: { activeFlag: true, currentPosition: { orgUnit: { OR: [{ id: { in: level3DepartmentIds } }, { parentUnitId: { in: level3DepartmentIds } }] } } },
          select: { id: true, employeeNumber: true, fullLegalName: true },
          orderBy: { fullLegalName: "asc" },
        })
      : [];

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("trainingRequest.newRequest")}</h1>
      <div className="mt-4 max-w-2xl">
        <SubmitTrainingRequestForm selfEmployeeId={session.user.employeeId} departmentEmployees={departmentEmployees} />
      </div>
    </div>
  );
}
