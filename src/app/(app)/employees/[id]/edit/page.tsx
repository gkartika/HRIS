import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import { EditEmployeeForm } from "./edit-employee-form";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const isSelf = session.user.employeeId === id;
  if (!isSelf && !isHrAdmin(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const isHr = isHrAdmin(session);
  const [employee, educationLevels, ptkpStatuses] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    isHr
      ? prisma.educationLevel.findMany({
          where: { activeFlag: true },
          orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
        })
      : Promise.resolve([]),
    isHr
      ? prisma.ptkpStatus.findMany({
          where: { activeFlag: true },
          orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  if (!employee) notFound();

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("employee.detailTitle")}</h1>
      <div className="mt-4 max-w-xl">
        <EditEmployeeForm
          employee={employee}
          canEditLegalName={isHr}
          educationLevels={educationLevels}
          ptkpStatuses={ptkpStatuses}
        />
      </div>
    </div>
  );
}
