import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { savePrivateFile } from "../src/lib/file-storage";

const DEMO_PASSWORD = "Demo12345!";

async function main() {
  console.log("Seeding development-safe fictional sample data...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---------- DM-19/DM-20 master data (admin-maintained, editable via /admin) ----------
  const educationLevelLabels = [
    "Tidak/Belum Sekolah",
    "SD/Sederajat",
    "SMP/Sederajat",
    "SMA/SMK/Sederajat",
    "D1",
    "D2",
    "D3",
    "D4",
    "S1",
    "S2",
    "S3",
    "Lainnya",
  ];
  const educationLevelsByLabel = new Map<string, { id: string }>();
  for (const [index, label] of educationLevelLabels.entries()) {
    const level = await prisma.educationLevel.upsert({
      where: { label },
      update: {},
      create: { label, displayOrder: index },
    });
    educationLevelsByLabel.set(label, level);
  }

  const ptkpCodes: [string, string][] = [
    ["TK/0", "Tidak Kawin, 0 Tanggungan"],
    ["TK/1", "Tidak Kawin, 1 Tanggungan"],
    ["TK/2", "Tidak Kawin, 2 Tanggungan"],
    ["TK/3", "Tidak Kawin, 3 Tanggungan"],
    ["K/0", "Kawin, 0 Tanggungan"],
    ["K/1", "Kawin, 1 Tanggungan"],
    ["K/2", "Kawin, 2 Tanggungan"],
    ["K/3", "Kawin, 3 Tanggungan"],
    ["K/I/0", "Kawin, Istri Bekerja, 0 Tanggungan"],
    ["K/I/1", "Kawin, Istri Bekerja, 1 Tanggungan"],
    ["K/I/2", "Kawin, Istri Bekerja, 2 Tanggungan"],
    ["K/I/3", "Kawin, Istri Bekerja, 3 Tanggungan"],
  ];
  for (const [index, [code, label]] of ptkpCodes.entries()) {
    await prisma.ptkpStatus.upsert({
      where: { code },
      update: {},
      create: { code, label, displayOrder: index },
    });
  }

  // ---------- Org structure ----------
  const produksi = await prisma.orgUnit.upsert({
    where: { unitCode: "DEPT-PRODUKSI" },
    update: {},
    create: { unitType: "DEPARTMENT", unitCode: "DEPT-PRODUKSI", unitName: "Produksi", displayOrder: 1 },
  });
  await prisma.orgUnit.upsert({
    where: { unitCode: "DEPT-QD" },
    update: {},
    create: {
      unitType: "DEPARTMENT",
      unitCode: "DEPT-QD",
      unitName: "Pengembangan Kualitas",
      displayOrder: 2,
    },
  });
  const sdm = await prisma.orgUnit.upsert({
    where: { unitCode: "DEPT-SDM" },
    update: {},
    create: {
      unitType: "DEPARTMENT",
      unitCode: "DEPT-SDM",
      unitName: "SDM & Pengembangan Organisasi",
      displayOrder: 3,
    },
  });
  await prisma.orgUnit.upsert({
    where: { unitCode: "DEPT-GA" },
    update: {},
    create: { unitType: "DEPARTMENT", unitCode: "DEPT-GA", unitName: "GA & Legal", displayOrder: 4 },
  });
  const direksi = await prisma.orgUnit.upsert({
    where: { unitCode: "DIREKSI" },
    update: {},
    create: { unitType: "DEPARTMENT", unitCode: "DIREKSI", unitName: "Direksi", displayOrder: 0 },
  });

  // ---------- Jobs ----------
  const jobDirector = await prisma.job.upsert({
    where: { jobCode: "DIREKTUR-UTAMA" },
    update: {},
    create: {
      jobCode: "DIREKTUR-UTAMA",
      jobTitle: "Direktur Utama",
      jobPurpose: "Memimpin arah strategis perusahaan secara keseluruhan.",
    },
  });
  const jobDeptHeadProduksi = await prisma.job.upsert({
    where: { jobCode: "PROD-DEPTHEAD" },
    update: {},
    create: {
      jobCode: "PROD-DEPTHEAD",
      jobTitle: "Kepala Departemen Produksi",
      jobPurpose: "Memimpin seluruh operasional Departemen Produksi.",
    },
  });
  const jobSectionHead = await prisma.job.upsert({
    where: { jobCode: "PROD-SECHEAD" },
    update: {},
    create: {
      jobCode: "PROD-SECHEAD",
      jobTitle: "Kepala Seksi Produksi",
      jobPurpose: "Memimpin operasional harian seksi produksi dan memastikan target output tercapai.",
    },
  });
  const jobStaff = await prisma.job.upsert({
    where: { jobCode: "PROD-STAFF" },
    update: {},
    create: {
      jobCode: "PROD-STAFF",
      jobTitle: "Staf Produksi",
      jobPurpose: "Menjalankan proses produksi sesuai standar kerja dan target kualitas.",
    },
  });
  // ACC-14/DEC-015: the HR Manager persona reference from the prototype
  // (Made Wirawan, Human Capital, "employee + hr_manager"), rebuilt on the
  // real Position-based access model — this Job/Position is what
  // grantsHrManagerAccess is set on below, not a stored role.
  const jobHrManager = await prisma.job.upsert({
    where: { jobCode: "SDM-HRMANAGER" },
    update: {},
    create: {
      jobCode: "SDM-HRMANAGER",
      jobTitle: "HR Manager",
      jobPurpose: "Memimpin fungsi SDM: keputusan rekrutmen, mutasi, kontrak, dan pengunduran diri karyawan.",
    },
  });

  // ---------- Positions ----------
  // ORG-15/DEC-011: Director is the single organization root, above every
  // Department Head. Left vacant on purpose — demonstrates "the Director
  // Position can remain visible when vacant" without needing a 6th demo
  // employee, and proves occupying it is not required for the hierarchy to
  // render correctly.
  const positionDirector = await prisma.position.upsert({
    where: { positionCode: "POS-DIREKTUR-01" },
    update: {},
    create: {
      positionCode: "POS-DIREKTUR-01",
      jobId: jobDirector.id,
      jobLevel: "5",
      orgUnitId: direksi.id,
      positionType: "DIRECTOR",
      positionStatus: "VACANT",
    },
  });
  const positionDeptHeadProduksi = await prisma.position.upsert({
    where: { positionCode: "POS-PROD-DEPTHEAD-01" },
    update: {},
    create: {
      positionCode: "POS-PROD-DEPTHEAD-01",
      jobId: jobDeptHeadProduksi.id,
      jobLevel: "4",
      orgUnitId: produksi.id,
      positionType: "DEPARTMENT_HEAD",
      positionStatus: "VACANT",
      reportsToPositionId: positionDirector.id,
    },
  });
  const positionSectionHead = await prisma.position.upsert({
    where: { positionCode: "POS-PROD-SECHEAD-01" },
    update: {},
    create: {
      positionCode: "POS-PROD-SECHEAD-01",
      jobId: jobSectionHead.id,
      jobLevel: "3A",
      orgUnitId: produksi.id,
      positionType: "SECTION_HEAD",
      positionStatus: "FILLED",
      reportsToPositionId: positionDeptHeadProduksi.id,
    },
  });
  // Self-heal the reporting line even if this position already existed from
  // a prior seed run (before the Director/Dept Head layer existed) — upsert's
  // `update: {}` above intentionally leaves existing rows alone, so this
  // reparents it explicitly without touching anything else about the row.
  if (positionSectionHead.reportsToPositionId !== positionDeptHeadProduksi.id) {
    await prisma.position.update({
      where: { id: positionSectionHead.id },
      data: { reportsToPositionId: positionDeptHeadProduksi.id },
    });
  }
  const positionStaff = await prisma.position.upsert({
    where: { positionCode: "POS-PROD-STAFF-01" },
    update: {},
    create: {
      positionCode: "POS-PROD-STAFF-01",
      jobId: jobStaff.id,
      jobLevel: "2A",
      orgUnitId: produksi.id,
      positionType: "STAFF",
      positionStatus: "FILLED",
      reportsToPositionId: positionSectionHead.id,
    },
  });
  // A second, currently vacant staff seat — demonstrates DM: "a Position can be
  // vacant and must continue to exist without an employee."
  await prisma.position.upsert({
    where: { positionCode: "POS-PROD-STAFF-02" },
    update: {},
    create: {
      positionCode: "POS-PROD-STAFF-02",
      jobId: jobStaff.id,
      jobLevel: "2A",
      orgUnitId: produksi.id,
      positionType: "STAFF",
      positionStatus: "VACANT",
      reportsToPositionId: positionSectionHead.id,
    },
  });
  // ACC-14: the only Position in this seed with grantsHrManagerAccess set —
  // reports directly to the Director, same tier as the Production
  // Department Head. Occupying it (below) is what grants Made Wirawan HR
  // Manager access; the flag on the Position, not an AccountRole.
  const positionHrManager = await prisma.position.upsert({
    where: { positionCode: "POS-SDM-HRMANAGER-01" },
    update: {},
    create: {
      positionCode: "POS-SDM-HRMANAGER-01",
      jobId: jobHrManager.id,
      jobLevel: "4",
      orgUnitId: sdm.id,
      positionType: "DEPARTMENT_HEAD",
      positionStatus: "VACANT",
      reportsToPositionId: positionDirector.id,
      grantsHrManagerAccess: true,
    },
  });
  // Self-heal the flag even against a database seeded before this Position
  // existed — same idempotent-reparenting pattern used for the Director
  // layer above.
  if (!positionHrManager.grantsHrManagerAccess) {
    await prisma.position.update({
      where: { id: positionHrManager.id },
      data: { grantsHrManagerAccess: true },
    });
  }

  // ---------- Employees ----------
  const hireDateBudi = new Date("2022-03-01");
  const budi = await prisma.employee.upsert({
    where: { employeeNumber: "CBP-0001" },
    update: {},
    create: {
      employeeNumber: "CBP-0001",
      fullLegalName: "Budi Santoso",
      gender: "MALE",
      birthDate: new Date("1988-04-12"),
      birthPlace: "Semarang",
      personalEmail: "budi.pribadi@example.demo",
      mobileNumber: "0812-0000-0001",
      currentAddressLine: "Jl. Industri Raya No. 10",
      currentAddressRtRw: "002/004",
      currentAddressVillage: "Tlogosari Kulon",
      currentAddressDistrict: "Pedurungan",
      currentAddressCity: "Kota Semarang",
      currentAddressPostalCode: "50196",
      emergencyContactName: "Wati Santoso",
      emergencyContactRelation: "Istri",
      emergencyContactPhone: "0812-0000-0099",
      hireDate: hireDateBudi,
      employmentStatus: "PKWTT",
      currentPositionId: positionSectionHead.id,
      noKk: "3374010101880001",
      namaIbuKandung: "Sri Wahyuni",
      educationLevelId: educationLevelsByLabel.get("S1")!.id,
      ptkpStatusCode: "K/1",
    },
  });
  const hireDateSiti = new Date("2024-01-15");
  const siti = await prisma.employee.upsert({
    where: { employeeNumber: "CBP-0002" },
    update: {},
    create: {
      employeeNumber: "CBP-0002",
      fullLegalName: "Siti Rahayu",
      gender: "FEMALE",
      birthDate: new Date("1996-09-20"),
      birthPlace: "Kudus",
      personalEmail: "siti.pribadi@example.demo",
      mobileNumber: "0812-0000-0002",
      currentAddressLine: "Jl. Merdeka No. 5",
      currentAddressRtRw: "001/003",
      currentAddressVillage: "Sekayu",
      currentAddressDistrict: "Semarang Tengah",
      currentAddressCity: "Kota Semarang",
      currentAddressPostalCode: "50131",
      emergencyContactName: "Rahmat",
      emergencyContactRelation: "Ayah",
      emergencyContactPhone: "0812-0000-0098",
      bankAccountName: "Siti Rahayu",
      bankAccountNumber: "1234567890",
      taxId: "09.876.543.2-521.000",
      hireDate: hireDateSiti,
      employmentStatus: "PKWT",
      currentPositionId: positionStaff.id,
      noKk: "3374010101960002",
      namaIbuKandung: "Ngatinah",
      educationLevelId: educationLevelsByLabel.get("SMA/SMK/Sederajat")!.id,
      ptkpStatusCode: "TK/0",
    },
  });

  const hireDateMade = new Date("2020-06-01");
  const made = await prisma.employee.upsert({
    where: { employeeNumber: "CBP-0003" },
    update: {},
    create: {
      employeeNumber: "CBP-0003",
      fullLegalName: "Made Wirawan",
      gender: "MALE",
      birthDate: new Date("1985-11-02"),
      birthPlace: "Denpasar",
      personalEmail: "made.pribadi@example.demo",
      mobileNumber: "0812-0000-0003",
      currentAddressLine: "Jl. Pahlawan No. 22",
      currentAddressRtRw: "005/002",
      currentAddressVillage: "Wonotingal",
      currentAddressDistrict: "Candisari",
      currentAddressCity: "Kota Semarang",
      currentAddressPostalCode: "50252",
      emergencyContactName: "Ayu Wirawan",
      emergencyContactRelation: "Istri",
      emergencyContactPhone: "0812-0000-0097",
      hireDate: hireDateMade,
      employmentStatus: "PKWTT",
      currentPositionId: positionHrManager.id,
      noKk: "3374010101850003",
      namaIbuKandung: "Ketut Sari",
      educationLevelId: educationLevelsByLabel.get("S1")!.id,
      ptkpStatusCode: "K/2",
    },
  });

  await prisma.assignment.upsert({
    where: { id: "seed-assignment-made-primary" },
    update: {},
    create: {
      id: "seed-assignment-made-primary",
      employeeId: made.id,
      positionId: positionHrManager.id,
      assignmentType: "PRIMARY",
      primaryAssignmentFlag: true,
      status: "ACTIVE",
      effectiveFrom: hireDateMade,
    },
  });
  if (positionHrManager.positionStatus !== "FILLED") {
    await prisma.position.update({ where: { id: positionHrManager.id }, data: { positionStatus: "FILLED" } });
  }

  await prisma.assignment.upsert({
    where: { id: "seed-assignment-budi-primary" },
    update: {},
    create: {
      id: "seed-assignment-budi-primary",
      employeeId: budi.id,
      positionId: positionSectionHead.id,
      assignmentType: "PRIMARY",
      primaryAssignmentFlag: true,
      status: "ACTIVE",
      effectiveFrom: hireDateBudi,
    },
  });
  await prisma.assignment.upsert({
    where: { id: "seed-assignment-siti-primary" },
    update: {},
    create: {
      id: "seed-assignment-siti-primary",
      employeeId: siti.id,
      positionId: positionStaff.id,
      assignmentType: "PRIMARY",
      primaryAssignmentFlag: true,
      status: "ACTIVE",
      effectiveFrom: hireDateSiti,
    },
  });

  // ---------- Accounts ----------
  const hrAdmin = await prisma.account.upsert({
    where: { usernameOrEmail: "hr.admin@cbp.demo" },
    update: {},
    create: {
      usernameOrEmail: "hr.admin@cbp.demo",
      passwordHash,
      accountType: "ADMIN",
      adminScope: "PEOPLE_PAYROLL",
      accountStatus: "ACTIVE",
    },
  });
  await prisma.accountRole.upsert({
    where: { accountId_role: { accountId: hrAdmin.id, role: "HR_ADMIN" } },
    update: {},
    create: { accountId: hrAdmin.id, role: "HR_ADMIN" },
  });

  const trainingAdmin = await prisma.account.upsert({
    where: { usernameOrEmail: "training.admin@cbp.demo" },
    update: {},
    create: {
      usernameOrEmail: "training.admin@cbp.demo",
      passwordHash,
      accountType: "ADMIN",
      adminScope: "TRAINING",
      accountStatus: "ACTIVE",
    },
  });
  await prisma.accountRole.upsert({
    where: { accountId_role: { accountId: trainingAdmin.id, role: "TRAINING_ADMIN" } },
    update: {},
    create: { accountId: trainingAdmin.id, role: "TRAINING_ADMIN" },
  });

  const gaAdmin = await prisma.account.upsert({
    where: { usernameOrEmail: "ga.admin@cbp.demo" },
    update: {},
    create: {
      usernameOrEmail: "ga.admin@cbp.demo",
      passwordHash,
      accountType: "ADMIN",
      adminScope: "ASSETS",
      accountStatus: "ACTIVE",
    },
  });
  await prisma.accountRole.upsert({
    where: { accountId_role: { accountId: gaAdmin.id, role: "GA_ADMIN" } },
    update: {},
    create: { accountId: gaAdmin.id, role: "GA_ADMIN" },
  });

  const managerAccount = await prisma.account.upsert({
    where: { usernameOrEmail: "budi.manager@cbp.demo" },
    update: {},
    create: {
      usernameOrEmail: "budi.manager@cbp.demo",
      passwordHash,
      accountType: "EMPLOYEE_LOGIN",
      employeeId: budi.id,
      accountStatus: "ACTIVE",
    },
  });
  await prisma.accountRole.upsert({
    where: { accountId_role: { accountId: managerAccount.id, role: "EMPLOYEE" } },
    update: {},
    create: { accountId: managerAccount.id, role: "EMPLOYEE" },
  });

  const employeeAccount = await prisma.account.upsert({
    where: { usernameOrEmail: "siti.karyawan@cbp.demo" },
    update: {},
    create: {
      usernameOrEmail: "siti.karyawan@cbp.demo",
      passwordHash,
      accountType: "EMPLOYEE_LOGIN",
      employeeId: siti.id,
      accountStatus: "ACTIVE",
    },
  });
  await prisma.accountRole.upsert({
    where: { accountId_role: { accountId: employeeAccount.id, role: "EMPLOYEE" } },
    update: {},
    create: { accountId: employeeAccount.id, role: "EMPLOYEE" },
  });

  // ACC-14/DEC-015: Made's own personal login, linked to his Employee record
  // like any other employee account — no shared/generic "HR Manager" login,
  // and no AppRole granting HR Manager access. His workspace and approval
  // authority come entirely from holding the Primary Assignment to
  // positionHrManager above; ending that Assignment would remove it again.
  const hrManagerAccount = await prisma.account.upsert({
    where: { usernameOrEmail: "made.wirawan@cbp.demo" },
    update: {},
    create: {
      usernameOrEmail: "made.wirawan@cbp.demo",
      passwordHash,
      accountType: "EMPLOYEE_LOGIN",
      employeeId: made.id,
      accountStatus: "ACTIVE",
    },
  });
  await prisma.accountRole.upsert({
    where: { accountId_role: { accountId: hrManagerAccount.id, role: "EMPLOYEE" } },
    update: {},
    create: { accountId: hrManagerAccount.id, role: "EMPLOYEE" },
  });

  // ---------- Private file storage demo ----------
  const existingFile = await prisma.fileObject.findFirst({
    where: { employeeId: siti.id, category: "Kontrak Kerja" },
  });
  if (!existingFile) {
    const storageKey = `employees/${siti.id}/kontrak-kerja-contoh.txt`;
    await savePrivateFile(
      storageKey,
      Buffer.from(
        "CONTOH DOKUMEN FIKTIF — bukan dokumen resmi.\n\nKontrak Kerja Waktu Tertentu\nNama: Siti Rahayu\nNomor Karyawan: CBP-0002\n\nDokumen ini hanya untuk mendemonstrasikan penyimpanan berkas privat (CTL-06)."
      )
    );
    await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: "Kontrak Kerja - Contoh.txt",
        mimeType: "text/plain",
        sizeBytes: 220,
        sensitivity: "HIGHLY_RESTRICTED",
        employeeId: siti.id,
        uploadedByAccountId: hrAdmin.id,
        category: "Kontrak Kerja",
        confidential: true,
      },
    });
  }

  console.log("Seed complete.");
  console.log("Demo accounts (password for all: Demo12345!):");
  console.log("  HR Admin              hr.admin@cbp.demo");
  console.log("  Training & Comp Admin  training.admin@cbp.demo");
  console.log("  GA & Asset Admin       ga.admin@cbp.demo");
  console.log("  Manager (Budi)         budi.manager@cbp.demo");
  console.log("  Employee (Siti)        siti.karyawan@cbp.demo");
  console.log("  HR Manager (Made)      made.wirawan@cbp.demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
