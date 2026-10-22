"use client";

import { useState, type InputHTMLAttributes } from "react";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/lib/validation/employee-fields";

// File picker for the image-or-PDF uploads (BPJS cards, GA/absence/training
// evidence ...). The server rejects bodies over a few MB, and a phone photo is
// often 3-8 MB, so a large JPG/PNG is shrunk here, in the browser, before the
// form is submitted. PDFs cannot be shrunk, so one over the limit is refused
// right away with a clear message instead of failing after the upload.
const SHRINK_ABOVE_BYTES = 1.2 * 1024 * 1024;
const MAX_SIDE_PX = 2200;
const JPEG_QUALITY = 0.85;

async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff"; // JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob || blob.size >= file.size) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export function DocumentFileInput({
  accept = ".pdf,.jpg,.jpeg,.png",
  onChange,
  maxBytes = MAX_DOCUMENT_SIZE_BYTES,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { maxBytes?: number }) {
  const [note, setNote] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(event);
    const input = event.currentTarget;
    const file = input.files?.[0];
    setNote(null);
    if (!file) return;

    let result = file;
    if (file.type.startsWith("image/") && file.size > SHRINK_ABOVE_BYTES) {
      try {
        result = await shrinkImage(file);
      } catch {
        result = file; // unreadable image: let the server validate it
      }
      if (result !== file) {
        const dt = new DataTransfer();
        dt.items.add(result);
        input.files = dt.files;
        setNote({ text: `Foto diperkecil otomatis (${(file.size / 1048576).toFixed(1)} MB → ${(result.size / 1048576).toFixed(1)} MB).`, tone: "info" });
      }
    }

    if (result.size > maxBytes) {
      input.value = "";
      setNote({ text: `Ukuran berkas ${(result.size / 1048576).toFixed(1)} MB melebihi batas ${Math.round(maxBytes / 1048576)} MB. Perkecil berkas lalu pilih lagi.`, tone: "error" });
    }
  }

  return (
    <>
      <input {...rest} type="file" accept={accept} onChange={handleChange} />
      {note && <p className={`mt-1 text-[11px] ${note.tone === "error" ? "text-rose-600" : "text-slate-400"}`}>{note.text}</p>}
    </>
  );
}
