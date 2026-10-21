import { describe, expect, it } from "vitest";
import { mutationFillProblem } from "./mutation-fill";

const request = { jobId: "job-1", status: "RECRUITMENT_IN_PROGRESS" as const, requestedHeadcount: 2, filled: 0, mutationsUnderway: 0 };
const seat = { jobId: "job-1", positionStatus: "VACANT", archived: false };

describe("mutationFillProblem (filling a request with a Mutasi)", () => {
  it("accepts a Mutasi into a vacant seat of the request's job", () => {
    expect(mutationFillProblem({ request, movementType: "MUTATION", position: seat })).toBeNull();
    expect(mutationFillProblem({ request: { ...request, status: "PARTIALLY_FILLED", filled: 1 }, movementType: "MUTATION", position: seat })).toBeNull();
  });

  it("not while the request is held", () => {
    expect(mutationFillProblem({ request: { ...request, held: true }, movementType: "MUTATION", position: seat })).toMatch(/ditahan/);
    expect(mutationFillProblem({ request: { ...request, held: false }, movementType: "MUTATION", position: seat })).toBeNull();
  });

  it("is only for Mutasi, never Promosi or Demosi", () => {
    expect(mutationFillProblem({ request, movementType: "PROMOTION", position: seat })).toMatch(/Mutasi/);
    expect(mutationFillProblem({ request, movementType: "DEMOTION", position: seat })).toMatch(/Mutasi/);
  });

  it("needs the request to be open, with a job and a free seat", () => {
    expect(mutationFillProblem({ request: { ...request, jobId: null }, movementType: "MUTATION", position: seat })).toMatch(/Jabatan/);
    expect(mutationFillProblem({ request: { ...request, status: "DRAFT" }, movementType: "MUTATION", position: seat })).toMatch(/disetujui/);
    expect(mutationFillProblem({ request: { ...request, status: "FILLED", filled: 2 }, movementType: "MUTATION", position: seat })).not.toBeNull();
    expect(mutationFillProblem({ request: { ...request, filled: 2 }, movementType: "MUTATION", position: seat })).toMatch(/terisi penuh/);
  });

  it("does not let more Mutasi run than there are seats left", () => {
    expect(mutationFillProblem({ request: { ...request, filled: 1, mutationsUnderway: 1 }, movementType: "MUTATION", position: seat })).toMatch(/sedang diisi/);
    expect(mutationFillProblem({ request: { ...request, mutationsUnderway: 1 }, movementType: "MUTATION", position: seat })).toBeNull();
  });

  it("the seat must be vacant and of the request's job", () => {
    expect(mutationFillProblem({ request, movementType: "MUTATION", position: { ...seat, positionStatus: "FILLED" } })).toMatch(/kosong/);
    expect(mutationFillProblem({ request, movementType: "MUTATION", position: { ...seat, archived: true } })).toMatch(/kosong/);
    expect(mutationFillProblem({ request, movementType: "MUTATION", position: { ...seat, jobId: "job-2" } })).toMatch(/jabatan/);
  });
});
