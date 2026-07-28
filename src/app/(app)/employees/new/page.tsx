import { requireSession } from "@/lib/require-session";
import { canCreateEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateEmployeeForm } from "./create-employee-form";

export default async function NewEmployeePage() {
  const session = await requireSession();
  if (!canCreateEmployee(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [educationLevels, ptkpStatuses] = await Promise.all([
    prisma.educationLevel.findMany({
      where: { activeFlag: true },
      orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    }),
    prisma.ptkpStatus.findMany({
      where: { activeFlag: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("employee.addEmployee")}</h1>
      <div className="mt-4 max-w-2xl">
        <CreateEmployeeForm educationLevels={educationLevels} ptkpStatuses={ptkpStatuses} />
      </div>
    </div>
  );
}
