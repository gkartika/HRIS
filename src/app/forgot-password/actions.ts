"use server";

import { requestPasswordReset } from "@/lib/account-access";

// Always answers the same way — whether or not the email belongs to an account.
export async function requestPasswordResetAction(
  _prevState: "sent" | undefined,
  formData: FormData
): Promise<"sent" | undefined> {
  const email = (formData.get("email") as string) ?? "";
  await requestPasswordReset(email);
  return "sent";
}
