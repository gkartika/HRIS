import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageContracts } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateContractForm } from "./create-contract-form";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const { employeeId } = await searchParams;
  const session = await requireSession();
  if (!canManageContracts(session)) {
    return <AccessDenied />;
  }

  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) notFound();

    return (
      <div>
        <h1 className="text-lg font-medium text-slate-900">{t("contract.newContract")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {employee.fullLegalName} ({employee.employeeNumber})
        </p>
        <div className="mt-4 max-w-lg">
          <CreateContractForm employeeId={employee.id} defaultContractType={employee.employmentStatus} />
        </div>
      </div>
    );
  }

  // Reached from the Contracts list's own "Buat Kontrak Baru" entry point —
  // no Employee context yet, so the form itself picks who this is for.
  const employees = await prisma.employee.findMany({
    where: { activeFlag: true },
    orderBy: { fullLegalName: "asc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("contract.newContract")}</h1>
      <div className="mt-4 max-w-lg">
        <CreateContractForm employees={employees} />
      </div>
    </div>
  );
}
