import { describe, expect, it } from "vitest";
import { isRawMachineFormat, machineDateTime, machineName, mapMachineStatus } from "./fingerprint-attendance";

describe("raw machine export", () => {
  it("is recognised with English or Indonesian headers", () => {
    expect(isRawMachineFormat({ Name: "A", "Date/Time": "03/11/2026 07:00:00", Status: "C/In" })).toBe(true);
    expect(isRawMachineFormat({ Nama: "A", "Tgl/Waktu": "03/11/2026 07:00:00", Status: "C/Masuk" })).toBe(true);
    expect(isRawMachineFormat({ fingerprintDeviceUserId: "1", eventType: "CHECK_IN", eventAt: "2026-11-03 07:00:00" })).toBe(false);
    expect(isRawMachineFormat({ Nama: "A", Status: "C/Masuk" })).toBe(false);
    expect(isRawMachineFormat(undefined)).toBe(false);
  });

  it("reads the name and the time from either header", () => {
    expect(machineName({ Nama: "Budi" })).toBe("Budi");
    expect(machineName({ Name: "Budi" })).toBe("Budi");
    expect(machineDateTime({ "Tgl/Waktu": "03/11/2026 07:25:57" })).toBe("03/11/2026 07:25:57");
    expect(machineDateTime({ "Date/Time": "03/11/2026 07:25:57" })).toBe("03/11/2026 07:25:57");
  });

  it("maps C/In, C/Out, C/Masuk and C/Keluar", () => {
    expect(mapMachineStatus("C/In")).toBe("CHECK_IN");
    expect(mapMachineStatus(" c/masuk ")).toBe("CHECK_IN");
    expect(mapMachineStatus("C/Out")).toBe("CHECK_OUT");
    expect(mapMachineStatus("C/Keluar")).toBe("CHECK_OUT");
    expect(mapMachineStatus("Lembur")).toBeNull();
    expect(mapMachineStatus("")).toBeNull();
  });
});
