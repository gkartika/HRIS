// Who may open the Admin Produksi screens, in one place: the Production clerk for the Production department,
// Admin SDM for everything, and a 3A or 3B for the forms of their own department.
import type { Session } from "next-auth";
import { isHrAdmin, isProductionAdmin } from "@/lib/permissions";
import { approverOf, getDepartmentApprovers, getProductionDepartment, type DepartmentApprover } from "@/lib/production-forms-service";
import { approversText } from "@/lib/production-forms";

export interface FormsAccess {
  clerk: boolean;
  sdm: boolean;
  /** Set when the signed-in employee is the 3A or 3B of the form's department. */
  approver: DepartmentApprover | null;
}

export async function accessTo(session: Session, departmentId: string): Promise<FormsAccess> {
  return { clerk: isProductionAdmin(session), sdm: isHrAdmin(session), approver: await approverOf(session.user.employeeId, departmentId) };
}

export const canOpen = (a: FormsAccess) => a.clerk || a.sdm || !!a.approver;

// "Riswanto (3A) atau Suhartono (3B)" for the department of the Production clerk.
export async function productionApproversText(): Promise<{ departmentId: string; text: string } | null> {
  const dept = await getProductionDepartment();
  if (!dept) return null;
  return { departmentId: dept.id, text: approversText(await getDepartmentApprovers(dept.id)) };
}
