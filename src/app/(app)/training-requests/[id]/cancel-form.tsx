"use client";

import { ReasonForm } from "@/components/reason-form";
import { cancelTrainingRequest } from "../actions";
import { t } from "@/lib/i18n/id";

export function CancelForm({ requestId }: { requestId: string }) {
  return (
    <ReasonForm
      action={cancelTrainingRequest.bind(null, requestId)}
      triggerLabel={t("trainingRequest.cancelButton")}
      reasonLabel={t("trainingRequest.cancellationReasonLabel")}
      pendingLabel="Membatalkan..."
      fieldName="reason"
      variant="card"
      required
    />
  );
}
