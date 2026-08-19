-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeNumber" TEXT NOT NULL,
    "fullLegalName" TEXT NOT NULL,
    "nationalIdNumber" TEXT,
    "birthPlace" TEXT,
    "birthDate" DATETIME,
    "gender" TEXT,
    "personalEmail" TEXT,
    "workEmail" TEXT,
    "mobileNumber" TEXT,
    "currentAddress" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactRelation" TEXT,
    "emergencyContactPhone" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "taxId" TEXT,
    "bpjsEmploymentNumber" TEXT,
    "bpjsHealthNumber" TEXT,
    "noKk" TEXT,
    "namaIbuKandung" TEXT,
    "educationLevelId" TEXT,
    "ptkpStatusCode" TEXT,
    "ktpFileId" TEXT,
    "kkFileId" TEXT,
    "hireDate" DATETIME NOT NULL,
    "employmentStatus" TEXT NOT NULL,
    "currentPositionId" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_ptkpStatusCode_fkey" FOREIGN KEY ("ptkpStatusCode") REFERENCES "PtkpStatus" ("code") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_ktpFileId_fkey" FOREIGN KEY ("ktpFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_kkFileId_fkey" FOREIGN KEY ("kkFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_currentPositionId_fkey" FOREIGN KEY ("currentPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("activeFlag", "bankAccountName", "bankAccountNumber", "birthDate", "birthPlace", "bpjsEmploymentNumber", "bpjsHealthNumber", "createdAt", "currentAddress", "currentPositionId", "educationLevelId", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "employeeNumber", "employmentStatus", "fullLegalName", "gender", "hireDate", "id", "kkFileId", "ktpFileId", "mobileNumber", "namaIbuKandung", "nationalIdNumber", "noKk", "personalEmail", "ptkpStatusCode", "taxId", "updatedAt", "workEmail") SELECT "activeFlag", "bankAccountName", "bankAccountNumber", "birthDate", "birthPlace", "bpjsEmploymentNumber", "bpjsHealthNumber", "createdAt", "currentAddress", "currentPositionId", "educationLevelId", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "employeeNumber", "employmentStatus", "fullLegalName", "gender", "hireDate", "id", "kkFileId", "ktpFileId", "mobileNumber", "namaIbuKandung", "nationalIdNumber", "noKk", "personalEmail", "ptkpStatusCode", "taxId", "updatedAt", "workEmail" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");
CREATE UNIQUE INDEX "Employee_ktpFileId_key" ON "Employee"("ktpFileId");
CREATE UNIQUE INDEX "Employee_kkFileId_key" ON "Employee"("kkFileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

