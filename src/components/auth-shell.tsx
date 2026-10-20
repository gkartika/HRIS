import { AuthStage } from "@/components/auth-stage";
import { t } from "@/lib/i18n/id";

// Shared frame for the pre-login pages (login, forgot password, set password): the SAPA panel with the
// mascot, and the page's own form next to it. `intro` is what the mascot says first; "{sapaan}" becomes
// "Selamat pagi/siang/sore/malam" by the visitor's time.
export function AuthShell({ children, intro = t("auth.mascot.intro") }: { children: React.ReactNode; intro?: string }) {
  return <AuthStage intro={intro}>{children}</AuthStage>;
}
