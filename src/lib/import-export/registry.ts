import * as employees from "./employees";
import * as orgUnits from "./org-units";
import * as jobs from "./jobs";
import * as positions from "./positions";
import * as assignments from "./assignments";
import * as fingerprintAttendance from "./fingerprint-attendance";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import type { Session } from "next-auth";

export type DatasetKey =
  | "employees"
  | "org-units"
  | "jobs"
  | "positions"
  | "assignments"
  | "fingerprint-attendance";

export interface DatasetModule {
  label: string;
  templateHeaders: string[];
  templateExampleRow: Record<string, string>;
  dryRun: (rows: Record<string, string>[]) => Promise<DryRunRow[]>;
  commitRow: (raw: Record<string, string>) => Promise<CommitResult>;
  exportData: (session: Session) => Promise<ExportResult>;
}

export const DATASET_REGISTRY: Record<DatasetKey, DatasetModule> = {
  employees: employees as DatasetModule,
  "org-units": orgUnits as DatasetModule,
  jobs: jobs as DatasetModule,
  positions: positions as DatasetModule,
  assignments: assignments as DatasetModule,
  "fingerprint-attendance": fingerprintAttendance as DatasetModule,
};

export function isDatasetKey(value: string): value is DatasetKey {
  return value in DATASET_REGISTRY;
}
