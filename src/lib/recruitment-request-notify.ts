import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/mailer";
import { emailOfEmployee, trySend } from "@/lib/recruitment-flow";

// Tells the people involved in a recruitment request about a change somebody made to it (held, resumed,
// number reduced, Jabatan changed): the requester, the HR Manager(s), Admin SDM and Admin Rekrutmen, never the
// person who made the change. Email only, best effort: the change itself is already saved.
export async function notifyRequestParties(args: {
  requestId: string;
  requestNumber: string;
  requesterEmployeeId: string;
  actorAccountId: string;
  actorEmployeeId: string | null;
  subject: string;
  text: string;
}): Promise<void> {
  try {
    const [hrManagerHolders, adminAccounts] = await Promise.all([
      prisma.assignment.findMany({
        where: { status: "ACTIVE", position: { grantsHrManagerAccess: true } },
        select: { employeeId: true },
      }),
      prisma.account.findMany({
        where: { accountStatus: "ACTIVE", roles: { some: { role: { in: ["RECRUITMENT_ADMIN"] } } } },
        select: { id: true, usernameOrEmail: true },
      }),
    ]);

    const employeeIds = new Set<string>([args.requesterEmployeeId, ...hrManagerHolders.map((a) => a.employeeId)]);
    if (args.actorEmployeeId) employeeIds.delete(args.actorEmployeeId);

    const addresses = new Set<string>();
    for (const id of employeeIds) {
      const email = await emailOfEmployee(id);
      if (email) addresses.add(email.toLowerCase());
    }
    for (const account of adminAccounts) {
      if (account.id === args.actorAccountId) continue;
      if (account.usernameOrEmail.includes("@")) addresses.add(account.usernameOrEmail.toLowerCase());
    }

    const link = { url: `${appBaseUrl()}/recruitment/${args.requestId}`, label: `Buka ${args.requestNumber}` };
    for (const to of addresses) await trySend(to, args.subject, args.text, link);
  } catch (error) {
    console.error("[recruitment] request notification failed", error);
  }
}
