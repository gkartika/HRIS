-- "Nama di mesin absensi": the name the fingerprint machine writes for an employee when it differs from the full name in SAPA
-- (the machine cuts long names). Optional, set per employee by Admin SDM; employees without it are matched by their full name.
-- Additive: one nullable column, no existing row changes.
ALTER TABLE "Employee" ADD COLUMN "fingerprintMachineName" TEXT;
