import { describe, expect, it } from "vitest";
import { buildEmployeeNameIndex, machineNameProblem, normalizeName } from "./name-match";

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

describe("machineNameProblem", () => {
  const staff = [
    { id: "e1", fullLegalName: "Ahmad Mansur Bin Encam" },
    { id: "e2", fullLegalName: "Ahmad Faizin" },
    { id: "e3", fullLegalName: "Dewi Lestari" },
    { id: "e4", fullLegalName: "Dewi Lestari" },
  ];
  it("accepts a shorter name that nobody else uses, and an empty one", () => {
    expect(machineNameProblem("Ahmad Mansur", "e1", staff, [])).toBeNull();
    expect(machineNameProblem("  ", "e1", staff, [])).toBeNull();
  });
  it("refuses a name that is another employee's full name or machine name", () => {
    expect(machineNameProblem("ahmad  faizin", "e1", staff, [])).toContain("Ahmad Faizin");
    expect(machineNameProblem("Budi", "e1", staff, [{ employeeId: "e2", alias: "Budi" }])).toContain("Ahmad Faizin");
  });
  it("refuses a name already shared by two others", () => {
    expect(machineNameProblem("Dewi Lestari", "e1", staff, [])).toContain("lebih dari satu");
  });
  it("lets an employee keep their own full name or machine name", () => {
    expect(machineNameProblem("Ahmad Mansur Bin Encam", "e1", staff, [])).toBeNull();
    expect(machineNameProblem("Ahmad Mansur", "e1", staff, [{ employeeId: "e1", alias: "Ahmad Mansur" }])).toBeNull();
  });
  it("refuses a name that is too long", () => {
    expect(machineNameProblem("x".repeat(101), "e1", staff, [])).toContain("terlalu panjang");
  });
});
