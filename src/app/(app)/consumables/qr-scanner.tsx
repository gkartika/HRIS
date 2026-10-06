"use client";

import { useEffect, useRef, useState } from "react";
import { decodeQrFromImageData } from "@/lib/qr-decode";

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

// Camera QR scanner. Uses the browser's BarcodeDetector where it exists
// (Chrome/Edge) and falls back to decoding frames with jsQR elsewhere. Each
// distinct code is reported once, then ignored for a moment so a label held
// in front of the camera doesn't add the same item repeatedly. Needs HTTPS
// or localhost for camera access.
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onCodeRef = useRef(onCode);
  // Keep the latest callback without restarting the camera when it changes.
  useEffect(() => {
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let lastCode = "";
    let lastAt = 0;
    const canvas = document.createElement("canvas");
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;

    async function tick() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        let code: string | null = null;
        try {
          if (detector) {
            const found = await detector.detect(video);
            code = found[0]?.rawValue ?? null;
          } else {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
              code = decodeQrFromImageData(frame.data, frame.width, frame.height);
            }
          }
        } catch {
          // a bad frame is not fatal — try the next one
        }
        const now = Date.now();
        if (code && (code !== lastCode || now - lastAt > 2500)) {
          lastCode = code;
          lastAt = now;
          onCodeRef.current(code.trim());
        }
      }
      raf = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          void video.play();
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError("Kamera tidak bisa dibuka. Izinkan akses kamera di browser, atau ketik kode barang secara manual."));
    if (!navigator.mediaDevices?.getUserMedia) {
      // Camera API missing (non-HTTPS page or very old browser).
      queueMicrotask(() => setError("Browser ini tidak mendukung kamera di halaman ini. Gunakan HTTPS, atau ketik kode barang secara manual."));
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Scan QR barang</p>
          <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            Selesai
          </button>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
        ) : (
          <>
            <video ref={videoRef} muted playsInline className="mt-3 aspect-square w-full rounded-lg bg-slate-900 object-cover" />
            <p className="mt-2 text-[11.5px] text-slate-500">Arahkan kamera ke label QR. Barang yang terbaca langsung masuk ke keranjang; scan terus untuk menambah barang lain.</p>
          </>
        )}
      </div>
    </div>
  );
}
