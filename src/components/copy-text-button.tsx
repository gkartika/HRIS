"use client";

import { useState } from "react";

// Small "Salin" button: copies the text to the clipboard and says so for a moment.
export function CopyTextButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard not available: the number is on screen and can be selected by hand
        }
      }}
      className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
    >
      {copied ? "Tersalin" : label}
    </button>
  );
}
