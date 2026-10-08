import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ done?: string; reason?: string }> }) {
  const { done, reason } = await searchParams;
  const notice = done ? "Kata sandi tersimpan. Silakan masuk." : reason === "inactive" ? "Sesi Anda berakhir atau akun tidak aktif. Silakan masuk kembali." : undefined;
  return (
    <AuthShell>
      <LoginForm notice={notice} />
    </AuthShell>
  );
}
