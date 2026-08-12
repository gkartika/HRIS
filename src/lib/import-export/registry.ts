import * as employees from "./employees";
import * as orgUnits from "./org-units";
import * as jobs from "./jobs";
import * as positions from "./positions";
import * as assignments from "./assignments";
import * as fingerprintAttendance from "./fingerprint-attendance";
import * as competencyMigration from "./competency-migration";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import type { Session } from "next-auth";

export type DatasetKey =
  | "employees"
  | "org-units"
  | "jobs"
  | "positions"
  | "assignments"
  | "fingerprint-attendance"
  | "competency-migration";

export interface DatasetModule {
  label: string;
  templateHeaders: string[];
  templateExampleRow: Record<string, string>;
  dryRun: (rows: Record<string, string>[]) => Promise<DryRunRow[]>;
  // `session` is optional so existing single-arg modules keep working
  // unchanged — only competency-migration.ts (which needs the acting HR
  // Admin's account id for the historical cycle it lazily creates) reads it.
  commitRow: (raw: Record<string, string>, session?: Session) => Promise<CommitResult>;
  exportData: (session: Session) => Promise<ExportResult>;
}

export const DATASET_REGISTRY: Record<DatasetKey, DatasetModule> = {
  employees: employees as DatasetModule,
  "org-units": orgUnits as DatasetModule,
  jobs: jobs as DatasetModule,
  positions: positions as DatasetModule,
  assignments: assignments as DatasetModule,
  "fingerprint-attendance": fingerprintAttendance as DatasetModule,
  "competency-migration": competencyMigration as DatasetModule,
};

export function isDatasetKey(value: string): value is DatasetKey {
  return value in DATASET_REGISTRY;
}
