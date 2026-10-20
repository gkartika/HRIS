import Image from "next/image";
import type { Metadata } from "next";

// Public recruitment pages: no sign-in, never listed by search engines. Each page checks
// its own access (access code, private link) itself.
export const metadata: Metadata = {
  title: "Karier PT Cahaya Bukit Perunggu",
  robots: { index: false, follow: false },
};

export default function RecruitmentPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbf8fc]">
      <header className="border-b border-[#e6dcea] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-4">
          <Image src="/logo-cbp.png" alt="PT Cahaya Bukit Perunggu" width={150} height={48} priority className="h-auto w-[130px]" />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Rekrutmen</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-3xl px-5 pb-10 text-xs text-[#8a7e92]">
        PT Cahaya Bukit Perunggu ·{" "}
        <a href="https://www.ptcbp.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
          www.ptcbp.com
        </a>
      </footer>
    </div>
  );
}
