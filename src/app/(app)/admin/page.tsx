import Link from "next/link";
import { Building2, Briefcase, Network, GraduationCap, Receipt, MapPin, UserCheck, CalendarDays } from "lucide-react";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";

const SECTIONS = [
  {
    href: "/admin/org-units",
    icon: Building2,
    title: "Unit Organisasi",
    desc: "Departemen, Seksi, Grup, dan Tim",
  },
  {
    href: "/admin/jobs",
    icon: Briefcase,
    title: "Jabatan Standar",
    desc: "Definisi jabatan yang dapat dipakai ulang",
  },
  {
    href: "/admin/positions",
    icon: Network,
    title: "Posisi Organisasi",
    desc: "Kursi jabatan yang disetujui, termasuk yang kosong",
  },
  {
    href: "/admin/education-levels",
    icon: GraduationCap,
    title: "Pendidikan Terakhir",
    desc: "Daftar dropdown untuk data karyawan",
  },
  {
    href: "/admin/ptkp-status",
    icon: Receipt,
    title: "PTKP Pajak",
    desc: "Daftar kode PTKP untuk data karyawan",
  },
  {
    href: "/admin/attendance-geofences",
    icon: MapPin,
    title: "Lokasi Absensi",
    desc: "Titik lokasi dan radius untuk Check-in/Check-out Mobile",
  },
  {
    href: "/admin/absence-approvers",
    icon: UserCheck,
    title: "Penyetuju Absensi",
    desc: "Posisi penyetuju pertama per Departemen untuk Cuti/Izin/Sakit/Lainnya",
  },
  {
    href: "/admin/absence-entitlements",
    icon: CalendarDays,
    title: "Jatah Absensi Tahunan",
    desc: "Jumlah hari per tahun untuk setiap jenis Absensi",
  },
];

export default async function AdminHomePage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Pengaturan Struktur Organisasi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Kelola Unit Organisasi, Jabatan Standar, Posisi Organisasi, dan data master karyawan.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300"
            >
              <Icon size={18} className="text-indigo-500" />
              <p className="mt-2 text-sm font-medium text-slate-900">{s.title}</p>
              <p className="mt-1 text-xs text-slate-500">{s.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
