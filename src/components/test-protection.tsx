"use client";

import { useEffect, useState, type ReactNode } from "react";

// Keys that copy, cut, select all, print, save or view source are swallowed while a test is on screen.
const BLOCKED_KEYS = ["c", "x", "a", "p", "s", "u"];

/**
 * Wraps the questions of any applicant test (Cultural Fit and the other tests, and Tes Situasi Kerja) with the
 * same copy protection: selecting, copying, cutting, pasting, dragging, the right-click menu, printing and the
 * usual shortcuts are switched off; the content blurs when the browser tab is left; PrintScreen clears the
 * clipboard; and a faint watermark with the applicant's name covers the questions.
 *
 * This deters casual copying and sharing. A photo of the screen, or a determined person with the browser's
 * developer tools, cannot be stopped by any web page; the watermark makes a shared picture traceable.
 */
export function TestProtection({ watermarkName, children }: { watermarkName: string; children: ReactNode }) {
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && BLOCKED_KEYS.includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") void navigator.clipboard?.writeText("").catch(() => {});
    };
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const watermark = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='150'><text x='20' y='85' transform='rotate(-20 140 75)' font-family='sans-serif' font-size='14' fill='rgba(90,60,120,0.11)'>${watermarkName.replace(/[&<>"']/g, " ")} · CBP</text></svg>`
  )}")`;

  return (
    <div
      className="tp-protect"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Text boxes stay usable (essay answers); everything else cannot be selected, and nothing prints. */}
      <style>{`@media print { .tp-protect { display: none !important; } } .tp-protect, .tp-protect * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; } .tp-protect textarea, .tp-protect input[type="text"] { -webkit-user-select: text; user-select: text; }`}</style>
      <div className="relative" style={tabHidden ? { filter: "blur(14px)" } : undefined}>
        {children}
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: watermark }} aria-hidden="true" />
      </div>
    </div>
  );
}
