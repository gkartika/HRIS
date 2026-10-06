import jsQR from "jsqr";

// Decodes a QR code from raw RGBA pixels. Used by the camera scanner as the
// fallback where the browser has no BarcodeDetector (Firefox, Safari), and by
// the unit test that round-trips a generated label.
export function decodeQrFromImageData(data: Uint8ClampedArray, width: number, height: number): string | null {
  const result = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  return result ? result.data : null;
}
