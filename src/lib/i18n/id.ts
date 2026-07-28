// Centralized Bahasa Indonesia UI string dictionary (SCP-05).
// All frontend-facing text must come from here — never hardcode Indonesian
// (or English) copy directly in components. Technical/DB field names stay English.

export const strings = {
  app: {
    name: "Aplikasi SDM",
    company: "PT Cahaya Bukit Perunggu",
    tagline: "Manajemen Karyawan, Pengembangan Organisasi, dan Urusan Umum",
  },
  auth: {
    loginTitle: "Masuk ke Aplikasi SDM",
    loginSubtitle: "Gunakan akun demo Anda untuk masuk",
    usernameLabel: "Email atau Nama Pengguna",
    passwordLabel: "Kata Sandi",
    loginButton: "Masuk",
    loginError: "Email/nama pengguna atau kata sandi salah.",
    accountLocked: "Akun terkunci karena terlalu banyak percobaan gagal. Hubungi admin.",
    accountDisabled: "Akun ini telah dinonaktifkan.",
    logoutButton: "Keluar",
    demoAccountsTitle: "Akun Demo",
    signedInAs: "Masuk sebagai",
  },
  nav: {
    dashboard: "Beranda",
    employees: "Data Karyawan",
    organization: "Struktur Organisasi",
    myProfile: "Profil Saya",
    myTeam: "Tim Saya",
    importData: "Impor Data",
    auditLog: "Log Aktivitas",
    settings: "Pengaturan",
  },
  roles: {
    HR_ADMIN: "Admin SDM",
    TRAINING_ADMIN: "Admin Pelatihan & Kompetensi",
    GA_ADMIN: "Admin GA & Aset",
    EMPLOYEE: "Karyawan",
    MANAGER: "Atasan/Manajer",
  },
  dataModel: {
    job: "Jabatan Standar",
    position: "Posisi Organisasi",
    assignment: "Penempatan",
    employee: "Karyawan",
    orgUnit: "Unit Organisasi",
    account: "Akun Pengguna",
  },
  assignmentType: {
    PRIMARY: "Utama",
    ADDITIONAL: "Tambahan",
    ACTING: "Pejabat Sementara (Plt.)",
    TEMPORARY: "Sementara",
  },
  positionStatus: {
    PLANNED: "Direncanakan",
    VACANT: "Kosong",
    FILLED: "Terisi",
    FROZEN: "Dibekukan",
    CLOSED: "Ditutup",
  },
  employmentStatus: {
    PKWTT: "Tetap (PKWTT)",
    PKWT: "Tidak Tetap (PKWT)",
    HARIAN_LEPAS: "Harian Lepas",
    MAGANG: "Magang",
  },
  gender: {
    MALE: "Laki-laki",
    FEMALE: "Perempuan",
  },
  employee: {
    listTitle: "Data Karyawan",
    detailTitle: "Detail Karyawan",
    employeeNumber: "Nomor Karyawan",
    fullLegalName: "Nama Lengkap (sesuai dokumen resmi)",
    preferredName: "Nama Panggilan",
    gender: "Jenis Kelamin",
    birthDate: "Tanggal Lahir",
    birthPlace: "Tempat Lahir",
    workEmail: "Email Kantor",
    personalEmail: "Email Pribadi",
    mobileNumber: "Nomor HP",
    currentAddress: "Alamat Saat Ini",
    hireDate: "Tanggal Bergabung",
    employmentStatus: "Status Kepegawaian",
    currentPosition: "Posisi Saat Ini",
    department: "Departemen",
    noPosition: "Belum ada penempatan",
    sensitiveHidden: "Data ini tidak dapat diakses oleh peran Anda",
    addEmployee: "Tambah Karyawan",
    emptyState: "Belum ada data karyawan.",
  },
  assignmentUi: {
    title: "Penempatan Posisi",
    primaryBadge: "Utama",
    additionalBadge: "Tambahan",
    actingBadge: "Plt.",
    temporaryBadge: "Sementara",
    effectiveFrom: "Berlaku Sejak",
    effectiveTo: "Berlaku Sampai",
    ongoing: "Sampai saat ini",
  },
  importUi: {
    title: "Impor Data Karyawan",
    subtitle: "Unggah berkas CSV, tinjau pratinjau, lalu proses baris yang valid.",
    uploadLabel: "Pilih berkas CSV",
    uploadButton: "Unggah & Tinjau",
    previewTitle: "Pratinjau Impor",
    rowNumber: "Baris",
    status: "Status",
    statusValid: "Valid",
    statusRejected: "Ditolak",
    reason: "Alasan Penolakan",
    summary: "{valid} valid, {rejected} ditolak dari {total} baris",
    commitButton: "Proses Baris yang Valid",
    commitSuccess: "Impor berhasil diproses.",
    noBatches: "Belum ada riwayat impor.",
    batchHistory: "Riwayat Impor",
    downloadSample: "Unduh Contoh Berkas CSV",
  },
  auditUi: {
    title: "Log Aktivitas",
    subtitle: "Catatan tindakan yang tidak dapat diubah untuk keperluan audit.",
    time: "Waktu",
    actor: "Pengguna",
    action: "Tindakan",
    dataset: "Data",
    record: "ID Rekam",
    empty: "Belum ada aktivitas tercatat.",
  },
  auditAction: {
    VIEW: "Melihat",
    CREATE: "Membuat",
    UPDATE: "Mengubah",
    APPROVE: "Menyetujui",
    REJECT: "Menolak",
    IMPORT: "Mengimpor",
    EXPORT: "Mengekspor",
    PRINT: "Mencetak",
    RELEASE: "Merilis",
    DELETE: "Menghapus",
    LOGIN: "Masuk",
    LOGIN_FAILED: "Gagal Masuk",
    LOGOUT: "Keluar",
  },
  orgChart: {
    title: "Struktur Organisasi",
    comingSoon: "Bagan organisasi lengkap akan tersedia pada Fase 1.",
  },
  common: {
    save: "Simpan",
    cancel: "Batal",
    close: "Tutup",
    edit: "Ubah",
    delete: "Hapus",
    loading: "Memuat...",
    error: "Terjadi kesalahan",
    notFound: "Data tidak ditemukan",
    accessDenied: "Anda tidak memiliki akses ke halaman ini",
    confirm: "Konfirmasi",
    yes: "Ya",
    no: "Tidak",
    active: "Aktif",
    inactive: "Tidak Aktif",
  },
} as const;

export function t(path: string, vars?: Record<string, string | number>): string {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = strings;
  for (const part of parts) {
    value = value?.[part];
  }
  if (typeof value !== "string") return path;
  if (!vars) return value;
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replaceAll(`{${key}}`, String(val)),
    value
  );
}
