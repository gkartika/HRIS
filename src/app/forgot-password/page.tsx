import { ForgotPasswordForm } from "./forgot-form";
import { AuthShell } from "@/components/auth-shell";
import { t } from "@/lib/i18n/id";

export default function ForgotPasswordPage() {
  return (
    <AuthShell intro={t("auth.mascot.introForgot")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
