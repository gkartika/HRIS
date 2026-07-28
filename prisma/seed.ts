import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { savePrivateFile } from "../src/lib/file-storage";

const DEMO_PASSWORD = "Demo12345!";

async function main() {
  console.log("Seeding development-safe fictional sample data...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

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
  await prisma.orgUnit.upsert({
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

  // ---------- Jobs ----------
  const jobSectionHead = await prisma.job.upsert({
    where: { jobCode: "PROD-SECHEAD" },
    update: {},
    create: {
      jobCode: "PROD-SECHEAD",
      jobTitle: "Kepala Seksi Produksi",
      jobLevel: "3A",
      jobPurpose: "Memimpin operasional harian seksi produksi dan memastikan target output tercapai.",
    },
  });
  const jobStaff = await prisma.job.upsert({
    where: { jobCode: "PROD-STAFF" },
    update: {},
    create: {
      jobCode: "PROD-STAFF",
      jobTitle: "Staf Produksi",
      jobLevel: "2A",
      jobPurpose: "Menjalankan proses produksi sesuai standar kerja dan target kualitas.",
    },
  });

  // ---------- Positions ----------
  const positionSectionHead = await prisma.position.upsert({
    where: { positionCode: "POS-PROD-SECHEAD-01" },
    update: {},
    create: {
      positionCode: "POS-PROD-SECHEAD-01",
      jobId: jobSectionHead.id,
      orgUnitId: produksi.id,
      positionType: "SECTION_HEAD",
      positionStatus: "FILLED",
    },
  });
  const positionStaff = await prisma.position.upsert({
    where: { positionCode: "POS-PROD-STAFF-01" },
    update: {},
    create: {
      positionCode: "POS-PROD-STAFF-01",
      jobId: jobStaff.id,
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
      orgUnitId: produksi.id,
      positionType: "STAFF",
      positionStatus: "VACANT",
      reportsToPositionId: positionSectionHead.id,
    },
  });

  // ---------- Employees ----------
  const hireDateBudi = new Date("2022-03-01");
  const budi = await prisma.employee.upsert({
    where: { employeeNumber: "CBP-0001" },
    update: {},
    create: {
      employeeNumber: "CBP-0001",
      fullLegalName: "Budi Santoso",
      preferredName: "Budi",
      gender: "MALE",
      birthDate: new Date("1988-04-12"),
      birthPlace: "Semarang",
      workEmail: "budi.santoso@cbp.demo",
      personalEmail: "budi.pribadi@example.demo",
      mobileNumber: "0812-0000-0001",
      currentAddress: "Jl. Industri Raya No. 10, Semarang",
      emergencyContactName: "Wati Santoso",
      emergencyContactRelation: "Istri",
      emergencyContactPhone: "0812-0000-0099",
      hireDate: hireDateBudi,
      employmentStatus: "PKWTT",
      currentPositionId: positionSectionHead.id,
    },
  });
  const hireDateSiti = new Date("2024-01-15");
  const siti = await prisma.employee.upsert({
    where: { employeeNumber: "CBP-0002" },
    update: {},
    create: {
      employeeNumber: "CBP-0002",
      fullLegalName: "Siti Rahayu",
      preferredName: "Siti",
      gender: "FEMALE",
      birthDate: new Date("1996-09-20"),
      birthPlace: "Kudus",
      workEmail: "siti.rahayu@cbp.demo",
      personalEmail: "siti.pribadi@example.demo",
      mobileNumber: "0812-0000-0002",
      currentAddress: "Jl. Merdeka No. 5, Semarang",
      emergencyContactName: "Rahmat",
      emergencyContactRelation: "Ayah",
      emergencyContactPhone: "0812-0000-0098",
      bankAccountName: "Siti Rahayu",
      bankAccountNumber: "1234567890",
      taxId: "09.876.543.2-521.000",
      hireDate: hireDateSiti,
      employmentStatus: "PKWT",
      currentPositionId: positionStaff.id,
    },
  });

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
