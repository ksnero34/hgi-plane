"use client";

import { FC, useEffect, useState, FormEvent } from "react";
import { observer } from "mobx-react";
import { Check, Info, X } from "lucide-react";
import { EEstimateSystem, MAX_ESTIMATE_POINT_INPUT_LENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TEstimatePointsObject, TEstimateSystemKeys, TEstimateTypeErrorObject } from "@plane/types";
import { Spinner, TOAST_TYPE, Tooltip, setToast } from "@plane/ui";
import { cn, isEstimatePointValuesRepeated } from "@plane/utils";
import { EstimateInputRoot } from "@/components/estimates/inputs/root";
// helpers
// hooks
import { useEstimatePoint } from "@/hooks/store";
// plane web constants

type TEstimatePointUpdate = {
  workspaceSlug: string;
  projectId: string;
  estimateId: string | undefined;
  estimatePointId: string | undefined;
  estimateType: TEstimateSystemKeys;
  estimatePoints: TEstimatePointsObject[];
  estimatePoint: TEstimatePointsObject;
  handleEstimatePointValueUpdate: (estimateValue: string) => void;
  closeCallBack: () => void;
  estimatePointError?: TEstimateTypeErrorObject | undefined;
  handleEstimatePointError?: (newValue: string, message: string | undefined, mode?: "add" | "delete") => void;
};

export const EstimatePointUpdate: FC<TEstimatePointUpdate> = observer((props) => {
  const {
    workspaceSlug,
    projectId,
    estimateId,
    estimatePointId,
    estimateType,
    estimatePoints,
    estimatePoint,
    handleEstimatePointValueUpdate,
    closeCallBack,
    estimatePointError,
    handleEstimatePointError,
  } = props;
  // hooks
  const { updateEstimatePoint } = useEstimatePoint(estimateId, estimatePointId);
  // i18n
  const { t } = useTranslation();
  // states
  const [loader, setLoader] = useState(false);
  const [estimateInputValue, setEstimateInputValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (estimateInputValue === undefined && estimatePoint) setEstimateInputValue(estimatePoint?.value || "");
  }, [estimateInputValue, estimatePoint]);

  const handleSuccess = (value: string) => {
    handleEstimatePointValueUpdate(value);
    setEstimateInputValue("");
    closeCallBack();
  };

  const handleClose = () => {
    setEstimateInputValue("");
    closeCallBack();
  };

  const handleEstimateInputValue = (value: string) => {
    if (value.length <= MAX_ESTIMATE_POINT_INPUT_LENGTH) {
      setEstimateInputValue(() => value);
      handleEstimatePointError && handleEstimatePointError(value, undefined);
    }
  };

  const validateInput = (): boolean => {
    if (!estimateInputValue) {
      handleEstimatePointError && 
        handleEstimatePointError(estimateInputValue || "", t("project_settings.estimates.validation.empty"));
      return false;
    }

    const currentEstimateType: EEstimateSystem | undefined = estimateType;
    let isEstimateValid = false;

    const currentEstimatePointValues = estimatePoints
      .map((point) => (point?.key != estimatePoint?.key ? point?.value : undefined))
      .filter((value) => value != undefined) as string[];
    const isRepeated =
      (estimateType && isEstimatePointValuesRepeated(currentEstimatePointValues, estimateType, estimateInputValue)) ||
      false;

    if (isRepeated) {
      handleEstimatePointError && 
        handleEstimatePointError(estimateInputValue, t("project_settings.estimates.validation.already_exists"));
      return false;
    }

    if (currentEstimateType && [EEstimateSystem.TIME, EEstimateSystem.POINTS].includes(currentEstimateType)) {
      if (estimateInputValue && !isNaN(Number(estimateInputValue))) {
        if (Number(estimateInputValue) <= 0) {
          handleEstimatePointError && 
            handleEstimatePointError(estimateInputValue, t("project_settings.estimates.validation.min_length"));
          return false;
        } else {
          isEstimateValid = true;
        }
      }
    } else if (currentEstimateType && currentEstimateType === EEstimateSystem.CATEGORIES) {
      if (estimateInputValue && estimateInputValue.length > 0 && isNaN(Number(estimateInputValue))) {
        isEstimateValid = true;
      }
    }

    if (!isEstimateValid) {
      handleEstimatePointError &&
        handleEstimatePointError(
          estimateInputValue,
          [EEstimateSystem.POINTS, EEstimateSystem.TIME].includes(estimateType)
            ? t("project_settings.estimates.validation.numeric")
            : t("project_settings.estimates.validation.character")
        );
      return false;
    }

    return true;
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!workspaceSlug || !projectId) return;

    handleEstimatePointError && handleEstimatePointError(estimateInputValue || "", undefined, "delete");

    if (validateInput()) {
      // 이제 API 호출 대신 로컬 상태만 업데이트
      if (estimateInputValue === estimatePoint.value) {
        handleClose();
      } else {
        // 부모 컴포넌트에 변경 사항 알림
        handleSuccess(estimateInputValue || "");
      }
    }
  };

  return (
    <form onSubmit={handleUpdate} className="relative flex items-center gap-2 text-base pr-2.5">
      <div
        className={cn(
          "relative w-full border rounded flex items-center my-1",
          estimatePointError?.message ? `border-red-500` : `border-custom-border-200`
        )}
      >
        <EstimateInputRoot
          estimateType={estimateType}
          handleEstimateInputValue={handleEstimateInputValue}
          value={estimateInputValue}
        />
        {estimatePointError?.message && (
          <>
            <Tooltip
              tooltipContent={
                (estimateInputValue || "")?.length >= 1
                  ? t("project_settings.estimates.validation.unsaved_changes")
                  : estimatePointError?.message
              }
              position="bottom"
            >
              <div className="flex-shrink-0 w-3.5 h-3.5 overflow-hidden mr-3 relative flex justify-center items-center text-red-500">
                <Info size={14} />
              </div>
            </Tooltip>
          </>
        )}
      </div>

      {estimateInputValue && estimateInputValue.length > 0 && (
        <button
          type="submit"
          className="rounded-sm w-6 h-6 flex-shrink-0 relative flex justify-center items-center hover:bg-custom-background-80 transition-colors cursor-pointer text-green-500"
          disabled={loader}
        >
          {loader ? <Spinner className="w-4 h-4" /> : <Check size={14} />}
        </button>
      )}
      <button
        type="button"
        className="rounded-sm w-6 h-6 flex-shrink-0 relative flex justify-center items-center hover:bg-custom-background-80 transition-colors cursor-pointer"
        onClick={handleClose}
        disabled={loader}
      >
        <X size={14} className="text-custom-text-200" />
      </button>
    </form>
  );
});
