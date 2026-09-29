// Single source of truth for Job.approvalStatus's allowed values — was only
// defined inside admin/jobs/[id]/edit-form.tsx, so Impor Data Karyawan's
// Jabatan Standar module had no shared list to validate against. "Active" is
// the value every real imported Job actually carries; kept alongside
// "Approved" (the schema default for a brand-new Job) rather than merged or
// renamed since that's a data-meaning call, not this fix's to make.
export const JOB_APPROVAL_STATUSES = ["Active", "Draft", "Under Review", "Approved", "Retired"];
