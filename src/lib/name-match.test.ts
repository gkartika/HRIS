import { describe, expect, it } from "vitest";
import { buildEmployeeNameIndex, normalizeName } from "./name-match";

const people = [
  { id: "e1", fullLegalName: "Budi Santoso" },
  { id: "e2", fullLegalName: "Siti  Rahma" },
  { id: "e3", fullLegalName: "Dewi Lestari" },
  { id: "e4", fullLegalName: "dewi lestari" },
];

describe("buildEmployeeNameIndex", () => {
  it("finds an employee by full name, ignoring case and extra spaces", () => {
    const index = buildEmployeeNameIndex(people, []);
    expect(index.get(normalizeName("BUDI SANTOSO"))).toBe("e1");
    expect(index.get(normalizeName(" siti rahma "))).toBe("e2");
    expect(index.get(normalizeName("Tidak Ada"))).toBeUndefined();
  });

  it("two employees with the same name are ambiguous, not guessed", () => {
    expect(buildEmployeeNameIndex(people, []).get(normalizeName("Dewi Lestari"))).toBeNull();
  });

  it("a name on the machine finds the same employee as the full name does", () => {
    const index = buildEmployeeNameIndex(people, [{ employeeId: "e1", alias: "Budi S" }, { employeeId: "e1", alias: "Budi Santoso" }]);
    expect(index.get(normalizeName("budi s"))).toBe("e1");
    expect(index.get(normalizeName("Budi Santoso"))).toBe("e1");
  });

  it("a machine name that is also another employee's name is ambiguous", () => {
    expect(buildEmployeeNameIndex(people, [{ employeeId: "e1", alias: "Siti Rahma" }]).get(normalizeName("Siti Rahma"))).toBeNull();
  });

  it("two employees may tell the two apart with different machine names", () => {
    const index = buildEmployeeNameIndex(people, [{ employeeId: "e3", alias: "Dewi L" }, { employeeId: "e4", alias: "Dewi Lestari 2" }]);
    expect(index.get(normalizeName("Dewi L"))).toBe("e3");
    expect(index.get(normalizeName("Dewi Lestari 2"))).toBe("e4");
  });

  it("ignores an empty name", () => {
    expect(buildEmployeeNameIndex([{ id: "x", fullLegalName: "  " }], [{ employeeId: "x", alias: "" }]).size).toBe(0);
  });
});
