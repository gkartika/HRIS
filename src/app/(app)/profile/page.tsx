import { redirect } from "next/navigation";
import { requireSession } from "@/lib/require-session";

export default async function ProfilePage() {
  const session = await requireSession();
  if (!session.user.employeeId) {
    redirect("/dashboard");
  }
  redirect(`/employees/${session.user.employeeId}`);
}
