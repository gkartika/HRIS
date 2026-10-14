import { describe, it, expect } from "vitest";
import {
  formatGaRequestNumber,
  formatWorkOrderNumber,
  formatDisposalCaseNumber,
  canVerifyGaRequest,
  routeGaRequestAfterVerification,
  canDecideGaRequest,
  decideGaRequestStatus,
  canProcessGaRequest,
  canReviewGaRequestLoss,
  decideGaRequestLossStatus,
  canCancelGaRequestStatus,
  computeAssetStatusAfterLossReview,
  computeAssetStatusAfterMaintenanceOutcome,
  computeAssetStatusAfterDisposalExecution,
  canExecuteMaintenanceWorkOrder,
  canDecideDamageRequest,
  assetStatusAfterLossDecision,
  canCancelDisposalCase,
  computeAssetStatusAfterDisposalCancel,
  computeNextPlanDue,
  planDueState,
  canExecuteDisposalCase,
  disposalReasonForMaintenanceOutcome,
  blocksOffboardingGaRequest,
} from "./ga-operations";

describe("numbering", () => {
  it("formats each document number with a zero-padded sequence", () => {
    expect(formatGaRequestNumber(1, 2026)).toBe("GAR-2026-0001");
    expect(formatWorkOrderNumber(42, 2026)).toBe("WO-2026-0042");
    expect(formatDisposalCaseNumber(7, 2026)).toBe("DSP-2026-0007");
  });
});

describe("canVerifyGaRequest", () => {
  it("only SUBMITTED can be verified", () => {
    expect(canVerifyGaRequest("SUBMITTED")).toBe(true);
    expect(canVerifyGaRequest("APPROVED")).toBe(false);
  });
});

describe("routeGaRequestAfterVerification", () => {
  it("NEW_ASSET_NEED goes to approval or straight through", () => {
    expect(routeGaRequestAfterVerification("NEW_ASSET_NEED", true)).toBe("PENDING_APPROVAL");
    expect(routeGaRequestAfterVerification("NEW_ASSET_NEED", false)).toBe("APPROVED");
  });

  it("DAMAGE_OR_ABNORMAL_CONDITION always creates a work order", () => {
    expect(routeGaRequestAfterVerification("DAMAGE_OR_ABNORMAL_CONDITION", true)).toBe("WORK_ORDER_CREATED");
    expect(routeGaRequestAfterVerification("DAMAGE_OR_ABNORMAL_CONDITION", false)).toBe("WORK_ORDER_CREATED");
  });

  it("LOSS always goes to review", () => {
    expect(routeGaRequestAfterVerification("LOSS", false)).toBe("PENDING_LOSS_REVIEW");
  });
});

describe("canDecideGaRequest / decideGaRequestStatus", () => {
  it("only PENDING_APPROVAL can be decided, mapping to APPROVED/REJECTED", () => {
    expect(canDecideGaRequest("PENDING_APPROVAL")).toBe(true);
    expect(canDecideGaRequest("APPROVED")).toBe(false);
    expect(decideGaRequestStatus(true)).toBe("APPROVED");
    expect(decideGaRequestStatus(false)).toBe("REJECTED");
  });
});

describe("canProcessGaRequest", () => {
  it("only APPROVED can be processed", () => {
    expect(canProcessGaRequest("APPROVED")).toBe(true);
    expect(canProcessGaRequest("PENDING_APPROVAL")).toBe(false);
  });
});

describe("canReviewGaRequestLoss / decideGaRequestLossStatus", () => {
  it("only PENDING_LOSS_REVIEW can be reviewed, mapping to CONFIRMED/NOT_CONFIRMED", () => {
    expect(canReviewGaRequestLoss("PENDING_LOSS_REVIEW")).toBe(true);
    expect(canReviewGaRequestLoss("SUBMITTED")).toBe(true);
    expect(canReviewGaRequestLoss("LOSS_CONFIRMED")).toBe(false);
    expect(decideGaRequestLossStatus(true)).toBe("LOSS_CONFIRMED");
    expect(decideGaRequestLossStatus(false)).toBe("LOSS_NOT_CONFIRMED");
  });
});

describe("canCancelGaRequestStatus", () => {
  it("only pre-terminal statuses can be cancelled", () => {
    expect(canCancelGaRequestStatus("SUBMITTED")).toBe(true);
    expect(canCancelGaRequestStatus("PENDING_APPROVAL")).toBe(true);
    expect(canCancelGaRequestStatus("PENDING_LOSS_REVIEW")).toBe(true);
    expect(canCancelGaRequestStatus("APPROVED")).toBe(false);
    expect(canCancelGaRequestStatus("PROCESSED")).toBe(false);
  });
});

describe("computeAssetStatusAfterLossReview", () => {
  it("stays LOST_PENDING_REVIEW if confirmed, else reverts based on open custody", () => {
    expect(computeAssetStatusAfterLossReview(true, false)).toBe("LOST_PENDING_REVIEW");
    expect(computeAssetStatusAfterLossReview(true, true)).toBe("LOST_PENDING_REVIEW");
    expect(computeAssetStatusAfterLossReview(false, true)).toBe("IN_USE");
    expect(computeAssetStatusAfterLossReview(false, false)).toBe("AVAILABLE");
  });
});

describe("computeAssetStatusAfterMaintenanceOutcome", () => {
  it("OPERATIONAL returns to circulation based on open custody, BEYOND_REPAIR stays blocked", () => {
    expect(computeAssetStatusAfterMaintenanceOutcome("OPERATIONAL", true)).toBe("IN_USE");
    expect(computeAssetStatusAfterMaintenanceOutcome("OPERATIONAL", false)).toBe("AVAILABLE");
    expect(computeAssetStatusAfterMaintenanceOutcome("BEYOND_REPAIR", false)).toBe("PENDING_DISPOSAL");
  });
});

describe("computeAssetStatusAfterDisposalExecution", () => {
  it("always RETIRED", () => {
    expect(computeAssetStatusAfterDisposalExecution()).toBe("RETIRED");
  });
});

describe("canExecuteMaintenanceWorkOrder", () => {
  it("only OPEN can be executed", () => {
    expect(canExecuteMaintenanceWorkOrder("OPEN")).toBe(true);
    expect(canExecuteMaintenanceWorkOrder("COMPLETED")).toBe(false);
  });
});

describe("DisposalCase status transitions", () => {
  it("a case can be approved and carried out in one go until it is executed or cancelled", () => {
    expect(canExecuteDisposalCase("APPROVED")).toBe(true);
    expect(canExecuteDisposalCase("DRAFT")).toBe(true);
    expect(canExecuteDisposalCase("PENDING_APPROVAL")).toBe(true);
    expect(canExecuteDisposalCase("EXECUTED")).toBe(false);
    expect(canExecuteDisposalCase("REJECTED")).toBe(false);
  });
});

describe("disposalReasonForMaintenanceOutcome", () => {
  it("maps BEYOND_REPAIR only", () => {
    expect(disposalReasonForMaintenanceOutcome("BEYOND_REPAIR")).toBe("BEYOND_REPAIR");
    expect(disposalReasonForMaintenanceOutcome("OPERATIONAL")).toBe(null);
  });
});

describe("blocksOffboardingGaRequest", () => {
  it("NEW_ASSET_NEED never blocks, regardless of status", () => {
    expect(blocksOffboardingGaRequest("NEW_ASSET_NEED", "SUBMITTED")).toBe(false);
    expect(blocksOffboardingGaRequest("NEW_ASSET_NEED", "PENDING_APPROVAL")).toBe(false);
  });

  it("DAMAGE_OR_ABNORMAL_CONDITION blocks only while SUBMITTED", () => {
    expect(blocksOffboardingGaRequest("DAMAGE_OR_ABNORMAL_CONDITION", "SUBMITTED")).toBe(true);
    expect(blocksOffboardingGaRequest("DAMAGE_OR_ABNORMAL_CONDITION", "WORK_ORDER_CREATED")).toBe(false);
  });

  it("LOSS blocks while SUBMITTED or PENDING_LOSS_REVIEW, not once reviewed", () => {
    expect(blocksOffboardingGaRequest("LOSS", "SUBMITTED")).toBe(true);
    expect(blocksOffboardingGaRequest("LOSS", "PENDING_LOSS_REVIEW")).toBe(true);
    expect(blocksOffboardingGaRequest("LOSS", "LOSS_CONFIRMED")).toBe(false);
    expect(blocksOffboardingGaRequest("LOSS", "LOSS_NOT_CONFIRMED")).toBe(false);
  });
});

describe("simplified flow helpers", () => {
  it("accepts or turns down a damage report only while it is SUBMITTED", () => {
    expect(canDecideDamageRequest("SUBMITTED")).toBe(true);
    expect(canDecideDamageRequest("WORK_ORDER_CREATED")).toBe(false);
  });

  it("decides what a loss decision does to the asset", () => {
    expect(assetStatusAfterLossDecision(true, "SUBMITTED", true)).toBe("PENDING_DISPOSAL");
    expect(assetStatusAfterLossDecision(false, "SUBMITTED", true)).toBeNull();
    expect(assetStatusAfterLossDecision(false, "PENDING_LOSS_REVIEW", true)).toBe("IN_USE");
    expect(assetStatusAfterLossDecision(false, "PENDING_LOSS_REVIEW", false)).toBe("AVAILABLE");
  });

  it("lets a disposal case be cancelled until it is executed", () => {
    expect(canCancelDisposalCase("DRAFT")).toBe(true);
    expect(canCancelDisposalCase("APPROVED")).toBe(true);
    expect(canCancelDisposalCase("EXECUTED")).toBe(false);
    expect(canCancelDisposalCase("REJECTED")).toBe(false);
    expect(computeAssetStatusAfterDisposalCancel(true)).toBe("IN_USE");
    expect(computeAssetStatusAfterDisposalCancel(false)).toBe("AVAILABLE");
  });
});

describe("computeNextPlanDue", () => {
  const serviceDate = new Date("2026-10-10T00:00:00Z");
  const base = { serviceDate, odometerKm: 52000, intervalDays: 180, intervalKm: 10000, enteredNextDueDate: null, enteredNextDueKm: null };

  it("adds the interval to the service date and the odometer", () => {
    const r = computeNextPlanDue(base);
    expect(r.dueDate?.toISOString().slice(0, 10)).toBe("2027-04-08");
    expect(r.dueKm).toBe(62000);
  });

  it("lets what was typed win", () => {
    const typed = new Date("2026-12-01T00:00:00Z");
    const r = computeNextPlanDue({ ...base, enteredNextDueDate: typed, enteredNextDueKm: 60000 });
    expect(r.dueDate).toEqual(typed);
    expect(r.dueKm).toBe(60000);
  });

  it("leaves a part alone when there is no interval or no odometer", () => {
    expect(computeNextPlanDue({ ...base, intervalDays: null }).dueDate).toBeNull();
    expect(computeNextPlanDue({ ...base, odometerKm: null }).dueKm).toBeNull();
    expect(computeNextPlanDue({ ...base, intervalKm: null }).dueKm).toBeNull();
  });
});

describe("planDueState", () => {
  it("is amber within a week and red once late", () => {
    expect(planDueState(null)).toBe("NONE");
    expect(planDueState(-1)).toBe("OVERDUE");
    expect(planDueState(0)).toBe("SOON");
    expect(planDueState(7)).toBe("SOON");
    expect(planDueState(8)).toBe("LATER");
  });
});
