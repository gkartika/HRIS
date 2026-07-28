import { LoginForm } from "./login-form";
import { t } from "@/lib/i18n/id";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
          {t("app.company")}
        </p>
        <h1 className="text-xl font-semibold text-slate-900">{t("app.name")}</h1>
      </div>
      <LoginForm />
    </div>
  );
}
