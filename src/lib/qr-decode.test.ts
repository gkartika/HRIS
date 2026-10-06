import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { decodeQrFromImageData } from "./qr-decode";

// Renders a QR matrix to RGBA pixels, the same shape a camera frame has.
function renderQr(text: string, scale = 8, margin = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const dim = (size + margin * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!qr.modules.get(x, y)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = ((y + margin) * scale + dy) * dim + (x + margin) * scale + dx;
          data[px * 4] = data[px * 4 + 1] = data[px * 4 + 2] = 0;
        }
      }
    }
  }
  return { data, dim };
}

describe("QR label round trip", () => {
  it("decodes an item code printed on a label", () => {
    const { data, dim } = renderQr("APD-014");
    expect(decodeQrFromImageData(data, dim, dim)).toBe("APD-014");
  });

  it("returns null for a blank frame", () => {
    const blank = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    expect(decodeQrFromImageData(blank, 100, 100)).toBeNull();
  });
});
