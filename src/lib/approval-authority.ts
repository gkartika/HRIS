import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";

// The "who may decide this, and in which Position" check that every
// Dept Head -> HR Manager approval (Perubahan Posisi, Rekrutmen, …) repeated
// by hand. Live-resolved from active Assignments, same as ever: the caller
// must currently hold a qualifying Position, and the Position picked in the
// form (needed when someone holds more than one) must be one of theirs.
export type ApprovalAuthority = { ok: true; decisionPositionId: string } | { ok: false; error: string };

export async function authorizeDeptHeadDecision(params: {
  employeeId: string | null | undefined;
  departmentId: string;
  formData: FormData;
  noAccessMessage?: string;
}): Promise<ApprovalAuthority> {
  const positions = await getActiveDeptHeadPositions(params.employeeId, params.departmentId);
  if (positions.length === 0) {
    return {
      ok: false,
      error:
        params.noAccessMessage ??
        "Anda tidak memiliki akses. Hanya Kepala Departemen/Manajer (Level 3B) di department ini yang dapat memutuskan permintaan ini.",
    };
  }
  const decisionPositionId = params.formData.get("decisionPositionId") as string;
  if (!positions.some((p) => p.positionId === decisionPositionId)) {
    return { ok: false, error: "Posisi Kepala Departemen/Manajer yang dipilih tidak valid atau tidak lagi aktif." };
  }
  return { ok: true, decisionPositionId };
}

export async function authorizeHrManagerDecision(params: {
  employeeId: string | null | undefined;
  formData: FormData;
  noAccessMessage?: string;
}): Promise<ApprovalAuthority> {
  const positions = await getActiveHrManagerPositions(params.employeeId);
  if (positions.length === 0) {
    return {
      ok: false,
      error:
        params.noAccessMessage ?? "Anda tidak memiliki akses. Hanya HR Manager aktif yang dapat memutuskan permintaan ini.",
    };
  }
  const decisionPositionId = params.formData.get("decisionPositionId") as string;
  if (!positions.some((p) => p.positionId === decisionPositionId)) {
    return { ok: false, error: "Posisi HR Manager yang dipilih tidak valid atau tidak lagi aktif." };
  }
  return { ok: true, decisionPositionId };
}
