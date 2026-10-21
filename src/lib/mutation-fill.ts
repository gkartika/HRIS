import { canRequestAcceptFulfillment, computeFulfillmentCounts } from "@/lib/recruitment";
import type { MovementType, RecruitmentRequestStatus } from "@/generated/prisma/enums";

// "Isi dengan Mutasi": Admin SDM fills a recruitment request (permintaan tenaga kerja) with an existing employee's
// Mutasi (Perubahan Posisi) instead of a new hire. These are the rules for filing it; the move itself then goes
// through the usual approvals and, once carried out, the employee counts as one of the request's fulfilments.
export function mutationFillProblem(input: {
  request: { jobId: string | null; status: RecruitmentRequestStatus; requestedHeadcount: number; filled: number; mutationsUnderway: number; held?: boolean };
  movementType: MovementType;
  position: { jobId: string; positionStatus: string; archived: boolean };
}): string | null {
  const { request, movementType, position } = input;
  if (!request.jobId) return "Jabatan pada permintaan ini belum ditentukan.";
  if (request.held) return "Permintaan ini sedang ditahan. Lanjutkan dulu permintaannya.";
  if (!canRequestAcceptFulfillment(request.status)) return "Permintaan belum disetujui atau sudah ditutup.";
  if (computeFulfillmentCounts(request.requestedHeadcount, request.filled).isFull) return "Permintaan sudah terisi penuh.";
  if (request.filled + request.mutationsUnderway >= request.requestedHeadcount) {
    return "Semua kursi permintaan ini sedang diisi oleh Mutasi lain yang masih berjalan.";
  }
  if (movementType !== "MUTATION") return "Permintaan tenaga kerja hanya bisa diisi dengan Mutasi lewat tombol ini.";
  if (position.archived || position.positionStatus !== "VACANT") return "Posisi yang dipilih harus kursi yang masih kosong.";
  if (position.jobId !== request.jobId) return "Posisi yang dipilih harus sesuai jabatan pada permintaan ini.";
  return null;
}
