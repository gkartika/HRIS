import { describe, expect, it } from "vitest";
import { questionFormatWarnings } from "./question-format";

describe("questionFormatWarnings", () => {
  it("is quiet for a clean question", () => {
    expect(questionFormatWarnings("Pertanyaan:\n1. Apa langkah Anda?\n2. Mengapa?")).toEqual([]);
  });

  it("flags a line with only a comma, and says which line", () => {
    expect(questionFormatWarnings("Tim QC terdiri dari:\n● 1 Leader\n,\nHari ini:")).toEqual(['Baris 3 hanya berisi tanda "," dan ikut terlihat oleh pelamar.']);
  });

  it("lists several stray lines together (also with Windows line breaks)", () => {
    expect(questionFormatWarnings("A\r\n,\r\nB\r\n.\r\nC")).toEqual(["Baris 2, 4 hanya berisi tanda baca dan ikut terlihat oleh pelamar."]);
  });

  it("flags doubled punctuation once per kind", () => {
    expect(questionFormatWarnings("Apa langkah Anda??\nMengapa??\nTolong!!")).toEqual(["Ada tanda baca ganda (?? !!) yang terlihat oleh pelamar."]);
  });

  it("a bullet line or a normal sentence is not stray", () => {
    expect(questionFormatWarnings("● Satu\n- Dua\nSelesai.")).toEqual([]);
  });
});
