// Display maps (label + chip color) for statuses that more than one screen
// shows. One definition each, so a list page and its detail page can never
// drift apart. Single-screen maps stay next to the screen that owns them.
import type { ConsumableStatusValue } from "@/lib/consumables";

export const ASSET_STATUS_TONE: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700",
  IN_USE: "bg-indigo-50 text-indigo-700",
  UNDER_REPAIR: "bg-amber-50 text-amber-700",
  DISPOSED: "bg-slate-100 text-slate-500",
  LOST_PENDING_REVIEW: "bg-rose-50 text-rose-700",
  PENDING_DISPOSAL: "bg-rose-50 text-rose-700",
  RETIRED: "bg-slate-100 text-slate-500",
};

export const CUSTODY_STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-slate-100 text-slate-500",
};

export const CONSUMABLE_STATUS_TONE: Record<ConsumableStatusValue, string> = {
  AMAN: "bg-emerald-50 text-emerald-700",
  MENIPIS: "bg-amber-50 text-amber-700",
  HABIS: "bg-rose-50 text-rose-700",
};

export const DISPOSAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  PENDING_APPROVAL: "Menunggu Persetujuan",
  APPROVED: "Disetujui, belum keluar",
  REJECTED: "Dibatalkan",
  EXECUTED: "Disetujui, aset keluar",
};

export const DISPOSAL_STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  EXECUTED: "bg-indigo-50 text-indigo-700",
};

export const LIFECYCLE_STATUS_TONE: Record<string, string> = {
  AKAN_MASUK: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  OUT: "bg-rose-50 text-rose-700",
};

export const GA_REQUEST_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Diajukan",
  PENDING_APPROVAL: "Menunggu Persetujuan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  PROCESSED: "Diproses",
  WORK_ORDER_CREATED: "Dalam Perbaikan",
  COMPLETED: "Selesai",
  PENDING_LOSS_REVIEW: "Menunggu Peninjauan",
  LOSS_CONFIRMED: "Kehilangan Dikonfirmasi",
  LOSS_NOT_CONFIRMED: "Kehilangan Tidak Dikonfirmasi",
  CANCELLED: "Dibatalkan",
};

export const LEARNING_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Berjalan",
  ATTENDED: "Hadir",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const LEARNING_STATUS_TONE: Record<string, string> = {
  ASSIGNED: "bg-amber-100 text-amber-700",
  ATTENDED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export const COURSE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Dipublikasikan",
  ARCHIVED: "Diarsipkan",
};
