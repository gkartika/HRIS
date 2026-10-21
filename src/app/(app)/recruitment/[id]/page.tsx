import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { formatDateLong, formatDateTimeMedium } from "@/lib/format";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canApproveRecruitmentRequest,
  canApproveRecruitmentRequestAsDeptHead,
  canCreateEmployeeFromRequest,
  canCancelRecruitmentRequest,
  isHrAdmin,
  canManageRecruitment,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions, listDeptHeadApprovers } from "@/lib/dept-head";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  computeFulfillmentCounts,
  canRequestAcceptFulfillment,
  canCancelRequestStatus,
  canCloseRequestStatus,
  canResubmitRequestStatus,
} from "@/lib/recruitment";
import { countVacantSeatsByJob } from "@/lib/recruitment-seats";
import {
  StartReviewButton,
  DecisionButtons,
  DeptHeadDecisionButtons,
  CancelRequestForm,
  CloseRequestForm,
} from "./decision-forms";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { OPEN_MOVEMENT_STATUSES } from "@/lib/movement";
import { ApplicantsSection } from "./applicants-section";
import { JobForm, ManagePanel, ResumeButton, type JobChoice } from "./job-and-manage";
import { canHoldStatus, describeEvent, jobChangeNeedsReason } from "@/lib/recruitment-request-changes";

export default async function RecruitmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { id } = await params;
  const { stage } = await searchParams;
  const session = await requireSession();

  const request = await prisma.recruitmentRequest.findUnique({
    where: { id },
    include: {
      department: true,
      job: true,
      requesterEmployee: true,
      requesterPosition: { include: { job: true } },
      submittedByAccount: true,
      deptHeadDecisionByAccount: true,
      deptHeadDecisionPosition: { include: { job: true } },
      approvedByAccount: true,
      decisionPosition: { include: { job: true } },
      cancelledByAccount: true,
      cancelledByEmployee: true,
      closedByAccount: true,
      events: { orderBy: { createdAt: "desc" } },
      fulfillments: {
        include: { employee: true, assignment: { include: { position: { include: { job: true } } } } },
      },
      // Mutasi filed to fill this request ("Isi dengan Mutasi")
      movementRequests: {
        orderBy: { createdAt: "desc" },
        select: { id: true, requestNumber: true, status: true, employee: { select: { fullLegalName: true } }, proposedPosition: { select: { positionCode: true } } },
      },
    },
  });
  if (!request) notFound();

  const isOwnRequest = request.requesterEmployeeId === session.user.employeeId;
  const [hrManagerPositions, deptHeadPositions] = await Promise.all([
    getActiveHrManagerPositions(session.user.employeeId),
    getActiveDeptHeadPositions(session.user.employeeId, request.departmentId),
  ]);
  const activeHrManagerPositionIds = hrManagerPositions.map((p) => p.positionId);
  const isHrManagerNow = activeHrManagerPositionIds.length > 0;
  const activeDeptHeadPositionIds = deptHeadPositions.map((p) => p.positionId);
  const isDeptHeadNow = activeDeptHeadPositionIds.length > 0;

  if (!canManageRecruitment(session) && !isHrManagerNow && !isDeptHeadNow && !isOwnRequest) {
    return <AccessDenied />;
  }

  const counts = computeFulfillmentCounts(request.requestedHeadcount, request.fulfillments.length);
  const canApprove = canApproveRecruitmentRequest(activeHrManagerPositionIds);
  const canApproveAsDeptHead =
    canApproveRecruitmentRequestAsDeptHead(activeDeptHeadPositionIds) && request.status === "PENDING_DEPT_HEAD";
  const manageRecruitment = canManageRecruitment(session);
  const isHeld = request.heldAt !== null;
  // The requester only types a Jabatan name. Admin SDM / Admin Rekrutmen pick or create the standard Jabatan and
  // the level before the HR Manager approves, and can still change it after approval (with a reason).
  const canSetJobBeforeApproval = manageRecruitment && (request.status === "PENDING_DEPT_HEAD" || request.status === "SUBMITTED" || request.status === "UNDER_REVIEW");
  const canChangeJobAfterApproval = manageRecruitment && canHoldStatus(request.status);
  const canKeepRequest = canHoldStatus(request.status) && (manageRecruitment || isHrManagerNow || isOwnRequest);
  const needsJobData = canSetJobBeforeApproval || canChangeJobAfterApproval || (canApprove && !!request.jobId);

  // Vacant seats per Jabatan in this department, so a request for more people than seats is noticed early.
  // The three lookups are independent, so they run together.
  const [deptHeadApprovers, vacantByJob, jobRows, internalMovesUnderway] = await Promise.all([
    request.status === "PENDING_DEPT_HEAD" ? listDeptHeadApprovers([request.departmentId]) : Promise.resolve(new Map<string, { name: string; positionCode: string }[]>()),
    needsJobData ? countVacantSeatsByJob(request.departmentId) : Promise.resolve({} as Record<string, number>),
    canSetJobBeforeApproval || canChangeJobAfterApproval
      ? prisma.job.findMany({ orderBy: { jobTitle: "asc" }, select: { id: true, jobCode: true, jobTitle: true } })
      : Promise.resolve([]),
    canKeepRequest ? prisma.recruitmentCandidate.count({ where: { requestId: request.id, status: "MOVEMENT" } }) : Promise.resolve(0),
  ]);
  const jobChoices: JobChoice[] = jobRows
    .map((j) => ({ id: j.id, label: `${j.jobCode} ${j.jobTitle}${vacantByJob[j.id] ? ` · ${vacantByJob[j.id]} kursi kosong` : ""}`, vacant: vacantByJob[j.id] ?? 0 }))
    .sort((a, b) => Number(b.vacant > 0) - Number(a.vacant > 0));
  const jobFormProps = {
    requestId: request.id,
    jobs: jobChoices,
    currentJobId: request.jobId,
    currentLevel: request.requestedJobLevel,
    requestedText: request.requestedJobText,
    headcount: request.requestedHeadcount,
    needsReason: jobChangeNeedsReason(request.status),
  };
  const approveBlockedReason = request.jobId ? undefined : "Menunggu Admin SDM / Admin Rekrutmen menetapkan jabatan standar.";
  const canFulfill =
    canCreateEmployeeFromRequest(session) && canRequestAcceptFulfillment(request.status) && !counts.isFull && !isHeld;
  const mutationsUnderway = request.movementRequests.filter((m) => OPEN_MOVEMENT_STATUSES.includes(m.status)).length;
  const canFillWithMutation =
    isHrAdmin(session) && !!request.jobId && canFulfill && request.fulfillments.length + mutationsUnderway < request.requestedHeadcount;
  const canClose = canCloseRequestStatus(request.status) && (isHrAdmin(session) || isHrManagerNow);
  const canResubmit = canResubmitRequestStatus(request.status) && (isOwnRequest || isHrAdmin(session));
  const canCancel =
    canCancelRecruitmentRequest(session, request.requesterEmployeeId, activeHrManagerPositionIds) &&
    canCancelRequestStatus(request.status);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Rekrutmen", href: "/recruitment" }, { label: "Detail Permintaan" }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{request.requestNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {request.job?.jobTitle ?? request.requestedJobText ?? t("recruitment.jobPendingApproval")} — {request.department.unitName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isHeld && <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Ditahan</span>}
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {t(`recruitmentStatus.${request.status}`)}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.requestDate")}</p>
            <p className="text-sm text-slate-900">{formatDateLong(request.requestDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.reasonCode")}</p>
            <p className="text-sm text-slate-900">{t(`recruitmentReasonCode.${request.reasonCode}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.shiftCode")}</p>
            <p className="text-sm text-slate-900">{t(`shiftCode.${request.shiftCode}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.requestedPosition")}</p>
            <p className="text-sm text-slate-900">{request.requestedJobText ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.setJobToApprove")}</p>
            <p className="text-sm text-slate-900">{request.job ? `${request.job.jobCode} ${request.job.jobTitle}` : "Belum ditetapkan"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.requestedHeadcount")}</p>
            <p className="text-sm text-slate-900">{request.requestedHeadcount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.fulfillment")}</p>
            <p className="text-sm text-slate-900">
              {t("recruitment.filledOf", { filled: counts.filledCount, total: request.requestedHeadcount })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.educationRequirement")}</p>
            <p className="text-sm text-slate-900">{t(`educationRequirementCode.${request.educationRequirementCode}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.workExperience")}</p>
            <p className="text-sm text-slate-900">{t(`workExperienceBand.${request.workExperienceBand}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.ageBand")}</p>
            <p className="text-sm text-slate-900">{t(`ageBandLabel.${request.ageBand}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.genderRequirement")}</p>
            <p className="text-sm text-slate-900">
              {request.genderRequirement ? t(`gender.${request.genderRequirement}`) : "—"}
            </p>
          </div>
          {request.requestedJobLevel && (
            <div>
              <p className="text-xs text-slate-500">{t("recruitment.requestedJobLevel")}</p>
              <p className="text-sm text-slate-900">{t(`requestedJobLevel.${request.requestedJobLevel}`)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.submittedBy")}</p>
            <p className="text-sm text-slate-900">
              {request.requesterEmployee.fullLegalName}
              {request.requesterPosition ? ` (${request.requesterPosition.job.jobTitle})` : ""}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-500">{t("recruitment.jobDescription")}</p>
          <p className="text-sm text-slate-900">{request.jobDescriptionSnapshot}</p>
        </div>
        {request.specialCriteria && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("recruitment.specialCriteria")}</p>
            <p className="text-sm text-slate-900">{request.specialCriteria}</p>
          </div>
        )}
        {request.deptHeadDecisionNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">
              {t("recruitment.decisionNote")} ({t("recruitment.deptHeadApprovalSectionTitle")})
            </p>
            <p className="text-sm text-slate-900">{request.deptHeadDecisionNote}</p>
          </div>
        )}
        {request.decisionNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("recruitment.decisionNote")}</p>
            <p className="text-sm text-slate-900">{request.decisionNote}</p>
          </div>
        )}
        <p className="mt-4 text-xs text-slate-400">
          {t("recruitment.submittedBy")}: {request.submittedByAccount?.usernameOrEmail ?? "—"} (
          {formatDateLong(request.submittedAt)})
          {request.deptHeadDecisionByAccount && (
            <>
              {" · "}
              {t("recruitment.deptHeadDecisionBy")}: {request.deptHeadDecisionByAccount.usernameOrEmail} (
              {formatDateLong(request.deptHeadDecisionAt)})
              {request.deptHeadDecisionPosition && (
                <>
                  {" — "}
                  {t("recruitment.deptHeadDecisionPosition")}: {request.deptHeadDecisionPosition.job.jobTitle} (
                  {request.deptHeadDecisionPosition.positionCode})
                </>
              )}
            </>
          )}
          {request.approvedByAccount && (
            <>
              {" · "}
              {t("recruitment.approvedBy")}: {request.approvedByAccount.usernameOrEmail} ({formatDateLong(request.approvedAt)})
              {request.decisionPosition && (
                <> — {t("recruitment.decisionPosition")}: {request.decisionPosition.job.jobTitle} ({request.decisionPosition.positionCode})</>
              )}
            </>
          )}
          {request.status === "CLOSED" && (
            <>
              {" · "}
              {t("recruitment.closedBy")}: {request.closedByAccount?.usernameOrEmail ?? "—"} (
              {formatDateLong(request.closedAt)}){request.closeReason && <> — {request.closeReason}</>}
            </>
          )}
          {request.status === "CANCELLED" && (
            <>
              {" · "}
              {t("recruitment.cancelledBy")}:{" "}
              {request.cancelledByEmployee?.fullLegalName ?? request.cancelledByAccount?.usernameOrEmail ?? "—"}
              {" "}({t(`cancellationAuthority.${request.cancellationAuthority}`)}, {formatDateLong(request.cancelledAt)})
              {request.cancellationReason && <> — {request.cancellationReason}</>}
            </>
          )}
        </p>
      </div>

      {request.status === "PENDING_DEPT_HEAD" && (
        <div className={`rounded-xl border p-5 text-sm ${deptHeadApprovers.get(request.departmentId)?.length ? "border-sky-200 bg-sky-50 text-sky-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
          {deptHeadApprovers.get(request.departmentId)?.length ? (
            <p>
              <b>Menunggu persetujuan Kepala Departemen {request.department.unitName}:</b>{" "}
              {deptHeadApprovers.get(request.departmentId)!.map((a) => `${a.name} (${a.positionCode})`).join(", ")}
            </p>
          ) : (
            <>
              <p>
                <b>Belum ada yang bisa menyetujui.</b> Departemen {request.department.unitName} tidak punya Kepala Departemen (posisi level 3B yang terisi), jadi permintaan ini tidak akan pernah sampai ke HR Manager.
              </p>
              <p className="mt-1 text-xs">
                {manageRecruitment || isHrManagerNow || isOwnRequest
                  ? "Pilihan: batalkan permintaan ini lalu ajukan lagi dengan departemen yang benar, atau minta Admin SDM mengisi posisi Kepala Departemen di Pengaturan > Posisi Organisasi."
                  : "Hubungi Admin SDM."}
              </p>
            </>
          )}
        </div>
      )}
      {isHeld && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p>
            <b>Permintaan ini ditahan</b> sejak {formatDateLong(request.heldAt)}. Alasan: {request.heldReason}
          </p>
          <p className="mt-1 text-xs text-amber-800">Lowongan publik tidak menerima pelamar baru. Pelamar yang ada tetap tersimpan.</p>
          {canKeepRequest && <ResumeButton requestId={request.id} />}
        </div>
      )}
      {canSetJobBeforeApproval && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            Jabatan standar{" "}
            {!request.jobId && <span className="ml-1 text-xs font-normal text-amber-700">belum ditetapkan</span>}
          </h2>
          <p className="mb-3 mt-1 text-sm text-slate-600">
            Ditulis pengaju: <b>&quot;{request.requestedJobText ?? "—"}&quot;</b>. HR Manager baru bisa menyetujui setelah jabatan ditetapkan.
          </p>
          <JobForm key={request.jobId ?? "none"} {...jobFormProps} submitLabel={request.jobId ? "Simpan perubahan" : "Simpan jabatan"} />
        </div>
      )}
      {canResubmit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-900">{t("recruitment.resubmitTitle")}</p>
          <p className="mt-1 text-sm text-amber-800">{t("recruitment.resubmitHint")}</p>
          <Link
            href={`/recruitment/${request.id}/edit`}
            className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("recruitment.resubmitButton")}
          </Link>
        </div>
      )}
      {canApproveAsDeptHead && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-900">{t("recruitment.deptHeadApprovalSectionTitle")}</p>
          <DeptHeadDecisionButtons requestId={request.id} positions={deptHeadPositions} />
        </div>
      )}
      {canApprove && (request.status === "SUBMITTED" || request.status === "UNDER_REVIEW") && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p className="text-xs text-slate-500">Jabatan standar (ditetapkan Admin SDM / Admin Rekrutmen)</p>
            {request.job ? (
              <>
                <p className="font-medium text-slate-900">
                  {request.job.jobTitle}
                  {request.requestedJobLevel ? ` · ${t(`requestedJobLevel.${request.requestedJobLevel}`)}` : ""} · kursi kosong {vacantByJob[request.job.id] ?? 0} dari {request.requestedHeadcount} dibutuhkan
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Ditulis pengaju: &quot;{request.requestedJobText ?? "—"}&quot;</p>
              </>
            ) : (
              <p className="text-amber-800">Menunggu Admin SDM / Admin Rekrutmen menetapkan jabatan. Tombol Setujui aktif setelah itu.</p>
            )}
          </div>
          {request.status === "SUBMITTED" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <StartReviewButton requestId={request.id} />
            </div>
          )}
          <div className="mt-3">
            <DecisionButtons requestId={request.id} positions={hrManagerPositions} approveBlockedReason={approveBlockedReason} />
          </div>
        </div>
      )}
      {canKeepRequest && (
        <ManagePanel
          requestId={request.id}
          headcount={request.requestedHeadcount}
          filled={request.fulfillments.length}
          underway={mutationsUnderway + internalMovesUnderway}
          held={isHeld}
          jobForm={canChangeJobAfterApproval ? { ...jobFormProps, submitLabel: "Ubah jabatan" } : null}
        />
      )}
      {canClose && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-1 text-sm font-medium text-slate-900">{t("recruitment.closeRequestTitle")}</p>
          <p className="mb-3 text-xs text-slate-500">{t("recruitment.closeRequestHint")}</p>
          <CloseRequestForm requestId={request.id} />
        </div>
      )}
      {canCancel && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-900">{t("recruitment.cancelRequestButton")}</p>
          <CancelRequestForm requestId={request.id} />
        </div>
      )}

      {request.events.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">Riwayat</p>
          <div className="mt-2 divide-y divide-slate-100">
            {request.events.map((e) => (
              <p key={e.id} className="py-2 text-sm text-slate-700">
                <span className="text-xs text-slate-500">{formatDateTimeMedium(e.createdAt)} WIB · </span>
                {e.actorLabel} {describeEvent(e)}
              </p>
            ))}
          </div>
        </div>
      )}
      {canManageRecruitment(session) && (
        <ApplicantsSection
          request={{
            id: request.id,
            jobId: request.jobId,
            heldAt: request.heldAt,
            status: request.status,
            openFor: request.openFor,
            accessCode: request.accessCode,
            requestedHeadcount: request.requestedHeadcount,
            testsCustomized: request.testsCustomized,
            testTypeIds: request.testTypeIds,
          }}
          filledCount={counts.filledCount}
          stage={stage}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900">{t("recruitment.linkedEmployees")}</h2>
          <div className="flex flex-wrap gap-2">
            {canFillWithMutation && (
              <Link
                href={`/movements/new?recruitmentRequestId=${request.id}`}
                className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Isi dengan Mutasi
              </Link>
            )}
            {canFulfill && (
              <Link
                href={`/recruitment/${request.id}/create-employee`}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                {t("recruitment.createEmployeeFromRequest")}
              </Link>
            )}
          </div>
        </div>
        {request.fulfillments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">{t("recruitment.noLinkedEmployees")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {request.fulfillments.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2 text-sm"
              >
                <Link href={`/employees/${f.employeeId}`} className="text-indigo-600 hover:underline">
                  {f.employee.fullLegalName} ({f.employee.employeeNumber})
                </Link>
                <span className="text-xs text-slate-500">{f.assignment.position.job.jobTitle}</span>
              </div>
            ))}
          </div>
        )}
        {request.movementRequests.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500">Mutasi untuk permintaan ini</p>
            <div className="mt-2 space-y-2">
              {request.movementRequests.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-4 py-2 text-sm">
                  <Link href={`/movements/${m.id}`} className="text-indigo-600 hover:underline">
                    {m.employee.fullLegalName} · {m.requestNumber}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {m.proposedPosition.positionCode} · {t(`movementStatus.${m.status}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
