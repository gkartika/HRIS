import { Building2, User, Clock, LogOut, Award, type LucideIcon } from "lucide-react";

export interface SettingsPage {
  href: string;
  label: string;
}

export interface SettingsGroup {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  pages: SettingsPage[];
}

// One card per group on the Pengaturan home; every page inside a group shows
// the same tab bar (settings-tabs.tsx), so switching pages never means going
// back to the home first.
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "org",
    title: "Struktur Organisasi",
    desc: "Susunan unit, jabatan, dan kursi posisi perusahaan.",
    icon: Building2,
    pages: [
      { href: "/admin/org-units", label: "Unit Organisasi" },
      { href: "/admin/jobs", label: "Jabatan Standar" },
      { href: "/admin/positions", label: "Posisi Organisasi" },
    ],
  },
  {
    id: "karyawan",
    title: "Pengaturan Data Karyawan",
    desc: "Daftar pilihan yang dipakai di form data karyawan.",
    icon: User,
    pages: [
      { href: "/admin/education-levels", label: "Pendidikan Terakhir" },
      { href: "/admin/ptkp-status", label: "PTKP Pajak" },
    ],
  },
  {
    id: "absensi",
    title: "Pengaturan Absensi",
    desc: "Jenis absensi, alur persetujuan, jatah, jadwal, dan lokasi check-in.",
    icon: Clock,
    pages: [
      { href: "/admin/absence-settings?tab=jenis", label: "Jenis Absensi" },
      { href: "/admin/absence-settings?tab=penyetuju", label: "Penyetuju per Unit" },
      { href: "/admin/absence-settings?tab=jatah", label: "Jatah per Karyawan" },
      { href: "/admin/absence-settings?tab=libur", label: "Libur & Jadwal Kerja" },
      { href: "/admin/attendance-geofences", label: "Lokasi Absensi" },
    ],
  },
  {
    id: "offboarding",
    title: "Offboarding",
    desc: "Alasan keluar dan pertanyaan klirens untuk karyawan yang berhenti.",
    icon: LogOut,
    pages: [
      { href: "/admin/offboarding-reasons", label: "Alasan Keluar" },
      { href: "/admin/exit-clearance-questions", label: "Pertanyaan Klirens Keluar" },
    ],
  },
  {
    id: "kompetensi",
    title: "Kerangka Kompetensi",
    desc: "Matrik Kompetensi dan Tata Nilai Perusahaan.",
    icon: Award,
    pages: [{ href: "/admin/competency", label: "Buka" }],
  },
];
