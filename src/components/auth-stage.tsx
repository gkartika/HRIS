"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { SapaMark, SapaMascot, type MascotMood } from "@/components/sapa-mascot";
import { currentPartOfDay, fillGreeting, greetingFor } from "@/lib/greeting";
import { t } from "@/lib/i18n/id";

// The look of the pre-login pages: the SAPA panel (name, slogan and the mascot that greets you by the time
// of day) next to the form. The mascot reacts to the form: forms call useAuthMood() to make it look
// worried (wrong password), happy (saved / sent) or just say something else.
interface MoodApi {
  setMood: (mood: MascotMood, text?: string | null) => void;
}
const AuthMoodContext = createContext<MoodApi>({ setMood: () => {} });
export const useAuthMood = () => useContext(AuthMoodContext);

const noSubscription = () => () => {};
// null on the server (the time is not known there), then the greeting for the visitor's WIB time.
const greetingNow = () => greetingFor(currentPartOfDay());
const greetingOnServer = () => null;

const SUNRISE = "bg-[linear-gradient(180deg,#4a2450_0%,#6f3a76_38%,#b9688a_70%,#f2b84b_100%)]";

export function AuthStage({ intro, children }: { intro: string; children: ReactNode }) {
  const [mood, setMoodState] = useState<{ mood: MascotMood; text: string | null }>({ mood: "normal", text: null });
  const greeting = useSyncExternalStore(noSubscription, greetingNow, greetingOnServer);
  const setMood = useCallback((next: MascotMood, text: string | null = null) => setMoodState({ mood: next, text }), []);
  const line = mood.text ?? fillGreeting(intro, greeting);

  return (
    <AuthMoodContext.Provider value={{ setMood }}>
      <div className="min-h-screen bg-[#fbf8fc] md:flex">
        <section
          aria-label={t("app.name")}
          className={`relative overflow-hidden px-[22px] pb-[70px] pt-[26px] text-white md:flex md:min-h-screen md:w-[46%] md:flex-col md:px-12 md:pb-8 md:pt-[52px] ${SUNRISE}`}
        >
          <div aria-hidden="true" className="absolute -right-[90px] -top-[90px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(253,239,10,.4),transparent_68%)]" />
          <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-auto w-full" viewBox="0 0 800 160" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 160 V92 L110 40 L220 98 L350 28 L490 104 L630 48 L800 108 V160Z" fill="rgba(61,31,64,.14)" />
            <path d="M0 160 V122 L100 86 L210 128 L340 80 L480 130 L610 92 L730 128 L800 106 V160Z" fill="rgba(61,31,64,.26)" />
          </svg>

          <div className="relative z-10 flex items-center gap-3">
            <SapaMark />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">{t("app.company")}</span>
          </div>

          <div className="relative z-10 mt-[38px]">
            <p className="text-[42px] font-extrabold leading-none tracking-[0.04em] md:text-[72px]">{t("app.name")}</p>
            <p className="mt-3 text-[13.5px] leading-snug text-white/90">
              <span className="font-extrabold text-brand-accent">S</span>istem <span className="font-extrabold text-brand-accent">A</span>dministrasi dan{" "}
              <span className="font-extrabold text-brand-accent">P</span>elayanan k<span className="font-extrabold text-brand-accent">A</span>ryawan
            </p>
            <div className="mt-5 h-[5px] w-12 rounded-full bg-brand-accent" />
            <p className="mt-5 max-w-[380px] text-base font-semibold leading-snug md:text-[25px]">{t("app.slogan")}</p>
          </div>

          <div className="relative z-10 mt-auto hidden items-end gap-3.5 pt-6 md:flex">
            <p className="sapa-bubble relative max-w-[210px] rounded-2xl bg-white px-4 py-3 text-[14.5px] font-semibold leading-snug text-[#3d1f40] shadow-[0_6px_18px_rgba(0,0,0,.14)]">{line}</p>
            <SapaMascot mood={mood.mood} className="block w-[190px] shrink-0" />
          </div>
          <SapaMascot mood={mood.mood} className="absolute right-3.5 top-[62px] z-[3] block w-[112px] md:hidden" />

          <p className="relative z-10 hidden pt-5 text-xs text-[#3d1f40]/75 md:block">{t("app.tagline")}</p>
        </section>

        <main className="relative z-10 -mt-[42px] px-5 pb-8 md:mt-0 md:flex md:flex-1 md:flex-col md:justify-center md:px-14 md:py-12">
          <div className="mx-auto w-full max-w-[380px] rounded-[20px] bg-white p-5 shadow-[0_8px_28px_rgba(61,31,64,.16)] md:rounded-none md:bg-transparent md:p-0 md:shadow-none">
            <Image src="/logo-cbp.png" alt={t("app.company")} width={180} height={57} priority className="mb-7 hidden h-auto w-[128px] md:block" />
            {greeting && <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-brand md:hidden">{greeting}</p>}
            {children}
          </div>
          <p className="mt-8 hidden px-6 text-center text-xs text-[#8a7e92] md:block">
            {t("app.name")} &middot; {t("app.fullName")}
            <br />
            <a href="https://www.ptcbp.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
              www.ptcbp.com
            </a>
          </p>
          <p className="mt-6 px-6 text-center text-xs text-[#8a7e92] md:hidden">
            {t("app.name")} &middot; {t("app.company")}
            <br />
            <a href="https://www.ptcbp.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
              www.ptcbp.com
            </a>
          </p>
        </main>
      </div>
    </AuthMoodContext.Provider>
  );
}
