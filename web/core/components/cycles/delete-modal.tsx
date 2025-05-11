"use client";

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams, useSearchParams } from "next/navigation";
// types
import { PROJECT_ERROR_MESSAGES, CYCLE_DELETED } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ICycle } from "@plane/types";
// ui
import { AlertModalCore, TOAST_TYPE, setToast } from "@plane/ui";
// constants
// hooks
import { useEventTracker, useCycle } from "@/hooks/store";
import { useAppRouter } from "@/hooks/use-app-router";

interface ICycleDelete {
  cycle: ICycle;
  isOpen: boolean;
  handleClose: () => void;
  workspaceSlug: string;
  projectId: string;
}

export const CycleDeleteModal: React.FC<ICycleDelete> = observer((props) => {
  const { isOpen, handleClose, cycle, workspaceSlug, projectId } = props;
  // states
  const [loader, setLoader] = useState(false);
  // store hooks
  const { captureCycleEvent } = useEventTracker();
  const { deleteCycle } = useCycle();
  const { t } = useTranslation();
  // router
  const router = useAppRouter();
  const { cycleId } = useParams();
  const searchParams = useSearchParams();
  const peekCycle = searchParams.get("peekCycle");

  const formSubmit = async () => {
    if (!cycle) return;

    setLoader(true);
    try {
      await deleteCycle(workspaceSlug, projectId, cycle.id)
        .then(() => {
          if (cycleId || peekCycle) router.push(`/${workspaceSlug}/projects/${projectId}/cycles`);
          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: "성공했습니다!",
            message: "주기가 삭제되었습니다.",
          });
          captureCycleEvent({
            eventName: CYCLE_DELETED,
            payload: { ...cycle, state: "SUCCESS" },
          });
        })
        .catch((errors) => {
          const isPermissionError = errors?.error === "권한이 없습니다.";
          const currentError = isPermissionError
            ? PROJECT_ERROR_MESSAGES.permissionError
            : PROJECT_ERROR_MESSAGES.cycleDeleteError;
          setToast({
            title: t(currentError.i18n_title),
            type: TOAST_TYPE.ERROR,
            message: currentError.i18n_message && t(currentError.i18n_message),
          });
          captureCycleEvent({
            eventName: CYCLE_DELETED,
            payload: { ...cycle, state: "FAILED" },
          });
        })
        .finally(() => handleClose());
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류가 발생했습니다!",
        message: "문제가 발생했습니다. 다시 시도해주세요.",
      });
    }

    setLoader(false);
  };

  return (
    <AlertModalCore
      handleClose={handleClose}
      handleSubmit={formSubmit}
      isSubmitting={loader}
      isOpen={isOpen}
      title="Delete cycle"
      content={
        <>
          Are you sure you want to delete cycle{' "'}
          <span className="break-words font-medium text-custom-text-100">{cycle?.name}</span>
          {'"'}? All of the data related to the cycle will be permanently removed. This action cannot be undone.
        </>
      }
    />
  );
});
