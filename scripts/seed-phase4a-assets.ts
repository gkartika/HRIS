// One-time UAT seed for Phase 4A — Employee Assets. Populates the Asset
// Master catalog + a few representative custody records so /assets and
// /assets/locations aren't empty for review. Deliberately does NOT touch
// EMP-0001 (A. ROKIB), who already has a PENDING_CLEARANCE Offboarding
// Case in this dataset — that employee is reserved for the live demo
// walkthrough (assign → offboarding blocked → return → offboarding
// continues), performed through the UI, not pre-seeded here.
import { prisma } from "../src/lib/db";

async function main() {
  const gaAdmin = await prisma.account.findFirstOrThrow({ where: { roles: { some: { role: "GA_ADMIN" } } } });

  const ahmadi = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: "EMP-0011" } });
  const financeUnit = await prisma.orgUnit.findFirstOrThrow({ where: { unitName: "Finance & Procurement" } });

  const gudangPusat = await prisma.assetLocation.upsert({
    where: { locationName: "Gudang Pusat - Jakarta" },
    update: {},
    create: { locationName: "Gudang Pusat - Jakarta", description: "Gudang penyimpanan aset utama kantor pusat" },
  });
  await prisma.assetLocation.upsert({
    where: { locationName: "Kantor Cabang Surabaya" },
    update: {},
    create: { locationName: "Kantor Cabang Surabaya", description: "Kantor cabang operasional Surabaya" },
  });
  await prisma.assetLocation.upsert({
    where: { locationName: "Ruang Server IT" },
    update: {},
    create: { locationName: "Ruang Server IT", description: "Ruang server dan peralatan jaringan" },
  });

  // Available, unassigned — for the live "assign to employee" demo.
  await prisma.fixedAsset.upsert({
    where: { assetCode: "AST-LAPTOP-001" },
    update: {},
    create: {
      assetCode: "AST-LAPTOP-001",
      assetName: "Laptop Dell Latitude 5420",
      category: "IT Equipment",
      trackingType: "INDIVIDUAL",
      status: "AVAILABLE",
      purchaseDate: new Date("2025-03-10"),
      purchaseCost: 14500000,
      createdByAccountId: gaAdmin.id,
    },
  });

  // Already assigned, to show an active custody in the list.
  const laptop002 = await prisma.fixedAsset.upsert({
    where: { assetCode: "AST-LAPTOP-002" },
    update: {},
    create: {
      assetCode: "AST-LAPTOP-002",
      assetName: "Laptop Lenovo ThinkPad T14",
      category: "IT Equipment",
      trackingType: "INDIVIDUAL",
      status: "IN_USE",
      purchaseDate: new Date("2025-06-01"),
      purchaseCost: 13800000,
      createdByAccountId: gaAdmin.id,
    },
  });
  const existingLaptop002Custody = await prisma.assetCustody.findFirst({ where: { assetId: laptop002.id } });
  if (!existingLaptop002Custody) {
    await prisma.assetCustody.create({
      data: {
        assetId: laptop002.id,
        targetType: "EMPLOYEE",
        employeeId: ahmadi.id,
        status: "ACTIVE",
        conditionAtHandover: "Baru, kondisi 100%",
        assignedByAccountId: gaAdmin.id,
      },
    });
  }

  // Department custody — shared equipment, never blocks offboarding.
  const standingDesk = await prisma.fixedAsset.upsert({
    where: { assetCode: "AST-DESK-001" },
    update: {},
    create: {
      assetCode: "AST-DESK-001",
      assetName: "Meja Kerja Standing Desk",
      category: "Office Furniture",
      trackingType: "INDIVIDUAL",
      status: "IN_USE",
      purchaseDate: new Date("2025-01-20"),
      purchaseCost: 3200000,
      createdByAccountId: gaAdmin.id,
    },
  });
  const existingDeskCustody = await prisma.assetCustody.findFirst({ where: { assetId: standingDesk.id } });
  if (!existingDeskCustody) {
    await prisma.assetCustody.create({
      data: {
        assetId: standingDesk.id,
        targetType: "DEPARTMENT",
        orgUnitId: financeUnit.id,
        status: "ACTIVE",
        conditionAtHandover: "Baik",
        assignedByAccountId: gaAdmin.id,
      },
    });
  }

  // Quantity-tracked stock, partly allocated to a Location.
  const chairs = await prisma.fixedAsset.upsert({
    where: { assetCode: "AST-CHAIR-POOL" },
    update: {},
    create: {
      assetCode: "AST-CHAIR-POOL",
      assetName: "Kursi Kantor Ergonomis",
      category: "Office Furniture",
      trackingType: "QUANTITY_TRACKED",
      status: "AVAILABLE",
      totalQuantity: 20,
      availableQuantity: 20,
      purchaseDate: new Date("2025-02-15"),
      purchaseCost: 1200000,
      createdByAccountId: gaAdmin.id,
    },
  });
  const existingChairCustody = await prisma.assetCustody.findFirst({ where: { assetId: chairs.id } });
  if (!existingChairCustody) {
    await prisma.assetCustody.create({
      data: {
        assetId: chairs.id,
        targetType: "LOCATION",
        locationId: gudangPusat.id,
        quantity: 5,
        status: "ACTIVE",
        assignedByAccountId: gaAdmin.id,
      },
    });
    await prisma.fixedAsset.update({ where: { id: chairs.id }, data: { availableQuantity: 15 } });
  }

  // Available, unassigned — extra catalog entry for browsing/import testing.
  await prisma.fixedAsset.upsert({
    where: { assetCode: "AST-PRINTER-001" },
    update: {},
    create: {
      assetCode: "AST-PRINTER-001",
      assetName: "Printer HP LaserJet Pro M404",
      category: "IT Equipment",
      trackingType: "INDIVIDUAL",
      status: "AVAILABLE",
      purchaseDate: new Date("2025-08-05"),
      purchaseCost: 4500000,
      createdByAccountId: gaAdmin.id,
    },
  });

  console.log("Phase 4A UAT asset data seeded.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
