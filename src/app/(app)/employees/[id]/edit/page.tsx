import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, isHrAdmin } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import { EditEmployeeForm } from "./edit-employee-form";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const isSelf = session.user.employeeId === id;
  if (!isSelf && !isHrAdmin(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) notFound();

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("employee.detailTitle")}</h1>
      <div className="mt-4 max-w-xl">
        <EditEmployeeForm employee={employee} canEditLegalName={isHrAdmin(session)} />
      </div>
    </div>
  );
}
