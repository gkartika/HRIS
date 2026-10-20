"use client";

import { useEffect, useRef, useState } from "react";

// A box to sign in with a finger or mouse. The drawing is kept as a PNG data URL in a
// hidden input called `name`, so it travels with the form; `onChange` also gets it for
// screens that do not use a form. A tap or a few stray pixels does not count as a signature.
const MIN_POINTS = 8;

export function SignaturePad({
  name = "signature",
  onChange,
  height = 140,
}: {
  name?: string;
  onChange?: (dataUrl: string) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [value, setValue] = useState("");
  const drawing = useRef(false);
  const points = useRef(0);

  // The drawing buffer follows the box's real width. Done again at the first touch, because
  // the box can have had no width when the page first rendered (hidden tab, narrow phone).
  function fit(canvas: HTMLCanvasElement) {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * ratio);
    const h = Math.round(height * ratio);
    if (w === 0 || (canvas.width === w && canvas.height === h)) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c2033";
  }

  useEffect(() => {
    if (canvasRef.current) fit(canvasRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    fit(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // not an active pointer (some test tools); drawing still works
    }
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    points.current += 1;
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    points.current += 1;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const signed = points.current >= MIN_POINTS;
    const url = signed ? (canvasRef.current?.toDataURL("image/png") ?? "") : "";
    setValue(url);
    onChange?.(url);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    points.current = 0;
    setValue("");
    onChange?.("");
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Kotak tanda tangan"
        style={{ height, touchAction: "none" }}
        className="w-full cursor-crosshair rounded-lg border-2 border-dashed border-slate-300 bg-slate-50"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <input type="hidden" name={name} value={value} readOnly />
      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
        <span>Gambar tanda tangan di kotak ini.</span>
        <button type="button" onClick={clear} className="font-medium text-indigo-600 hover:underline">
          Hapus
        </button>
      </div>
    </div>
  );
}
