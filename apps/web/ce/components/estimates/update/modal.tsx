import { useEffect, useState, useMemo, useRef } from "react";
import { observer } from "mobx-react";
import { ChevronLeft } from "lucide-react";
// ui
import { Button, ModalCore, EModalPosition, EModalWidth } from "@plane/ui";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// types
import type { TEstimatePointsObject, TEstimateTypeError, TEstimateSystemKeys, IEstimateFormData } from "@plane/types";
// hooks
import { useTranslation } from "@plane/i18n";
import { convertMinutesToHoursMinutesString, convertMinutesToHoursAndMinutes } from "@plane/utils";
import { useProjectEstimates } from "@/hooks/store/estimates/use-project-estimate";
import { useEstimate } from "@/hooks/store/estimates/use-estimate";
// components
import { EstimateCreateStageOne } from "@/components/estimates/create/stage-one";
import { EstimatePointCreateRoot } from "@/components/estimates/points";
// plane constants
import { EEstimateSystem } from "@plane/constants";
// services
import estimateService from "@/plane-web/services/project/estimate.service";

type TUpdateEstimateModal = {
  workspaceSlug: string;
  projectId: string;
  estimateId: string | undefined;
  isOpen: boolean;
  handleClose: () => void;
};

export const UpdateEstimateModal = observer((props: TUpdateEstimateModal) => {
  // props
  const { workspaceSlug, projectId, estimateId, isOpen, handleClose } = props;
  // hooks
  const { getProjectEstimates, getEstimateById } = useProjectEstimates();
  const estimate = estimateId ? getEstimateById(estimateId) : undefined;
  const { estimatePointIds, estimatePointById } = useEstimate(estimateId);
  const { t } = useTranslation();
  // states
  const [estimateSystem, setEstimateSystem] = useState<TEstimateSystemKeys>(EEstimateSystem.POINTS);
  const [estimatePoints, setEstimatePoints] = useState<TEstimatePointsObject[] | undefined>(undefined);
  const [estimatePointError, setEstimatePointError] = useState<TEstimateTypeError>({});
  const [buttonLoader, setButtonLoader] = useState(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  // 편집용 상태 관리 - 컴포넌트 레벨로 이동
  const [editingItemKey, setEditingItemKey] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // 추정 포인트 업데이트 핸들러
  const handleUpdatePoints = (newPoints: TEstimatePointsObject[] | undefined) => setEstimatePoints(newPoints);

  // 에러 처리 핸들러
  const handleEstimatePointError = (
    key: number,
    oldValue: string,
    newValue: string,
    message: string | undefined,
    mode: "add" | "delete" = "add"
  ) => {
    setEstimatePointError((prev) => {
      if (mode === "add") {
        return { ...prev, [key]: { oldValue, newValue, message } };
      } else {
        const newError = { ...prev };
        delete newError[key];
        return newError;
      }
    });
  };

  // 편집 시작
  const startEditing = (point: TEstimatePointsObject) => {
    setEditingItemKey(point.key);
    setEditValue(point.value);
  };

  // 편집 취소
  const cancelEditing = () => {
    setEditingItemKey(null);
    setEditValue("");
  };

  // 편집 확인
  const confirmEditing = () => {
    if (editingItemKey !== null) {
      handlePointValueChange(editingItemKey, editValue);
      setEditingItemKey(null);
      setEditValue("");
    }
  };

  // 에러 검증
  const validateEstimatePointError = () => {
    let hasError = false;

    if (!estimatePointError) return hasError;

    Object.keys(estimatePointError).forEach((key) => {
      const currentKey = parseInt(key);
      // 메시지가 있거나 값이 빈 경우에만 에러로 처리
      if (estimatePointError[currentKey]?.message || estimatePointError[currentKey]?.newValue === "") {
        hasError = true;
      }
    });

    // 모든 포인트에 값이 있는지 확인
    if (estimatePoints) {
      for (const point of estimatePoints) {
        if (!point.value || point.value.trim() === "") {
          hasError = true;
          break;
        }
      }
    }

    return hasError;
  };

  // 일반 입력값 변경 핸들러
  const handlePointValueChange = (key: number, value: string) => {
    // 에러 메시지 설정
    let errorMessage;
    if (!value.trim()) {
      errorMessage = "값을 입력해주세요";
    }

    // 에러 처리
    const pointToUpdate = estimatePoints?.find((p) => p.key === key);
    if (pointToUpdate) {
      handleEstimatePointError(key, pointToUpdate.value, value, errorMessage);
    }

    // 값 업데이트
    const newPoints = estimatePoints ? [...estimatePoints] : [];
    const pointIndex = newPoints.findIndex((p) => p.key === key);
    if (pointIndex !== -1) {
      newPoints[pointIndex] = {
        ...newPoints[pointIndex],
        value: value,
      };
      setEstimatePoints(newPoints);
    }
  };

  // 시간/분 입력값을 총 분으로 변환하여 업데이트하는 핸들러
  const handleTimeInputChange = (key: number, hours: number, minutes: number) => {
    // 최소 1분 이상이 입력되도록 함
    if (hours === 0 && minutes === 0) {
      minutes = 1;
    }

    // 총 분으로 변환
    const totalMinutes = hours * 60 + minutes;

    // 에러 메시지 설정
    let errorMessage;
    if (totalMinutes <= 0) {
      errorMessage = "유효한 시간을 입력해주세요";
    }

    // 에러 처리 및 값 업데이트
    const pointToUpdate = estimatePoints?.find((p) => p.key === key);
    if (pointToUpdate) {
      handleEstimatePointError(key, pointToUpdate.value, String(totalMinutes), errorMessage);

      // 값 업데이트
      const newPoints = estimatePoints ? [...estimatePoints] : [];
      const pointIndex = newPoints.findIndex((p) => p.key === key);
      if (pointIndex !== -1) {
        newPoints[pointIndex] = {
          ...newPoints[pointIndex],
          value: String(totalMinutes),
        };
        setEstimatePoints(newPoints);
      }
    }
  };

  // 현재 추정값 불러오기
  const loadCurrentEstimatePoints = () => {
    if (estimatePointIds && estimatePointIds.length > 0) {
      const existingPoints = estimatePointIds
        .map((pointId) => {
          const point = estimatePointById(pointId);
          if (point) {
            return {
              id: point.id,
              key: point.key,
              value: point.value,
            };
          }
          return null;
        })
        .filter((p) => p !== null) as TEstimatePointsObject[];

      // 포인트가 없으면 기본값 생성
      if (existingPoints.length === 0) {
        handleUpdatePoints([
          { id: undefined, key: 1, value: "1" },
          { id: undefined, key: 2, value: "2" },
        ]);
      } else {
        handleUpdatePoints(existingPoints);
      }
      setEditMode(true);
    } else {
      // 기본값
      handleUpdatePoints([
        { id: undefined, key: 1, value: "1" },
        { id: undefined, key: 2, value: "2" },
      ]);
      setEditMode(true);
    }
  };

  // 템플릿 또는 사용자 지정 선택 처리
  const handleEstimatePointsSelection = (templateKey: string) => {
    // custom 선택 시 기존 값을 불러와 수정 모드로 전환
    if (templateKey === "custom") {
      loadCurrentEstimatePoints();
    } else {
      // 템플릿 선택 시 바로 저장 처리
      handleSubmitEstimateUpdate(templateKey);
    }
  };

  // 현재 추정 시스템 타입 설정
  useEffect(() => {
    if (isOpen && estimate) {
      // 추정 시스템 타입 설정
      setEstimateSystem(estimate.type as TEstimateSystemKeys);
      // console.log("현재 추정 시스템 타입:", estimate.type);

      // 모달이 열릴 때 바로 편집 모드로 전환
      if (isOpen && !editMode) {
        loadCurrentEstimatePoints();
      }
    }
  }, [isOpen, estimate, editMode]);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setEditMode(false);
      setEstimatePoints(undefined);
      setEstimatePointError({});
    }
  }, [isOpen]);

  // 추정값 업데이트 제출
  const handleSubmitEstimateUpdate = async (templateKey?: string) => {
    try {
      if (!workspaceSlug || !projectId || !estimateId) return;

      // 사용자 지정 편집 모드에서 유효성 검사
      if (!templateKey && estimatePoints) {
        const hasEstimatePointError = validateEstimatePointError();
        if (hasEstimatePointError) return;
      }

      setButtonLoader(true);

      // 업데이트 호출
      if (templateKey) {
        // 템플릿 모드 - 서비스를 직접 호출
        await estimateService.updateEstimate(workspaceSlug, projectId, estimateId, {
          estimate: {
            type: templateKey,
          },
          estimate_points: [], // 템플릿 키를 전달할 때는 빈 배열로 전송하고 서버에서 처리
        });
      } else if (estimatePoints) {
        // 사용자 지정 모드 - 서비스를 직접 호출
        // 백엔드에서는 estimate_points 필드가 필요하므로 estimate와 함께 전달
        const payload: Partial<IEstimateFormData> = {
          estimate: {
            type: estimateSystem,
          },
          estimate_points: estimatePoints,
        };

        await estimateService.updateEstimate(workspaceSlug, projectId, estimateId, payload);
      }

      // 변경사항 반영을 위해 다시 불러오기
      await getProjectEstimates(workspaceSlug, projectId);

      setButtonLoader(false);

      // 성공 메시지
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("project_settings.estimates.toasts.updated.success.title"),
        message: t("project_settings.estimates.toasts.updated.success.message"),
      });

      // 모달 닫기
      handleClose();
    } catch (error) {
      // console.error("추정 업데이트 오류:", error);
      setButtonLoader(false);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("project_settings.estimates.toasts.updated.error.title"),
        message: t("project_settings.estimates.toasts.updated.error.message"),
      });
    }
  };

  const renderEstimateStepsCount = useMemo(() => (editMode ? "2" : "1"), [editMode]);

  // 시간 입력용 컴포넌트
  const TimeInput = ({ value, onChange }: { value: string; onChange: (hours: number, minutes: number) => void }) => {
    // 문자열 값을 숫자로 변환
    const totalMinutes = parseInt(value) || 0;

    // 시간과 분으로 변환
    const { hours, minutes } = convertMinutesToHoursAndMinutes(totalMinutes);

    // 로컬 상태 - 문자열로 관리하여 빈 값도 허용
    const [hoursValue, setHoursValue] = useState(hours.toString());
    const [minutesValue, setMinutesValue] = useState(minutes.toString());

    // 참조 생성
    const hoursInputRef = useRef<HTMLInputElement>(null);
    const minutesInputRef = useRef<HTMLInputElement>(null);

    // 컴포넌트가 마운트되거나 value가 변경될 때 시간과 분 값 업데이트
    useEffect(() => {
      const { hours: h, minutes: m } = convertMinutesToHoursAndMinutes(totalMinutes);
      setHoursValue(h.toString());
      setMinutesValue(m.toString());
    }, [totalMinutes]);

    // 부모에게 변경 알림 (마지막 포커스된 입력필드 정보 포함)
    const notifyParent = (h: number, m: number, lastFocused: "hours" | "minutes") => {
      // 둘 다 0인 경우 최소 1분 보장
      if (h === 0 && m === 0) {
        m = 1;
        if (lastFocused === "minutes") setMinutesValue("1");
      }

      // 상위 컴포넌트에 값만 알리고 리렌더링 최소화
      onChange(h, m);

      // 이전에 포커스된 필드에 포커스 유지
      setTimeout(() => {
        if (lastFocused === "hours" && hoursInputRef.current) {
          hoursInputRef.current.focus();
        } else if (lastFocused === "minutes" && minutesInputRef.current) {
          minutesInputRef.current.focus();
        }
      }, 0);
    };

    return (
      <div className="flex items-center space-x-2 w-full">
        <input
          ref={hoursInputRef}
          value={hoursValue}
          onChange={(e) => {
            const newValue = e.target.value;
            setHoursValue(newValue);

            // 유효한 숫자인 경우에만 부모에게 알림
            const newHours = newValue === "" ? 0 : parseInt(newValue);
            if (!isNaN(newHours) && newHours >= 0) {
              const minutesNum = minutesValue === "" ? 0 : parseInt(minutesValue);
              notifyParent(newHours, minutesNum, "hours");
            }
          }}
          onKeyDown={(e) => {
            // 백스페이스 처리
            if (e.key === "Backspace" && hoursValue === "0") {
              e.preventDefault();
              setHoursValue("0");
              setTimeout(() => {
                if (hoursInputRef.current) hoursInputRef.current.focus();
              }, 0);
            }
          }}
          className="border-none focus:ring-0 focus:border-0 focus:outline-none px-2 py-2 w-1/3 bg-transparent text-sm"
          placeholder="0"
          autoFocus
          type="number"
          min="0"
        />
        <span>시간</span>
        <input
          ref={minutesInputRef}
          value={minutesValue}
          onChange={(e) => {
            const newValue = e.target.value;
            setMinutesValue(newValue);

            // 유효한 숫자인 경우에만 부모에게 알림
            const newMinutes = newValue === "" ? 0 : parseInt(newValue);
            if (!isNaN(newMinutes) && newMinutes >= 0 && newMinutes < 60) {
              const hoursNum = hoursValue === "" ? 0 : parseInt(hoursValue);
              notifyParent(hoursNum, newMinutes, "minutes");
            }
          }}
          onKeyDown={(e) => {
            // 백스페이스 처리
            if (e.key === "Backspace" && minutesValue === "0") {
              e.preventDefault();
              setMinutesValue("0");
              setTimeout(() => {
                if (minutesInputRef.current) minutesInputRef.current.focus();
              }, 0);
            }
          }}
          className="border-none focus:ring-0 focus:border-0 focus:outline-none px-2 py-2 w-1/3 bg-transparent text-sm"
          placeholder="0"
          type="number"
          min="0"
          max="59"
        />
        <span>분</span>
      </div>
    );
  };

  // 사용자 정의 StageTwo 렌더링
  const renderStageTwo = () => {
    if (!estimatePoints) return null;

    // 현재 추정 시스템 타입 로깅
    // console.log("렌더링 시 추정 시스템 타입:", estimateSystem, estimate?.type);

    const isTimeEstimate = estimateSystem === "time" || estimate?.type === "time";

    return (
      <div className="space-y-6">
        <div className="text-sm font-medium text-custom-text-200">추정값 편집</div>
        <div className="grid grid-cols-1 gap-4">
          {estimatePoints.map((point) => (
            <div key={point.key} className="flex items-center gap-4">
              <div className="w-12 text-right text-sm font-medium">{point.key}:</div>
              <div className="flex-1">
                {editingItemKey === point.key ? (
                  <div className="flex items-center">
                    {isTimeEstimate ? (
                      <div className="border border-custom-border-200 rounded flex-grow">
                        <TimeInput
                          value={editValue}
                          onChange={(hours, minutes) => {
                            const totalMinutes = hours * 60 + minutes;
                            setEditValue(String(totalMinutes));
                          }}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full rounded-md border border-custom-border-200 px-3 py-1 text-sm"
                        placeholder="값 입력"
                        autoFocus
                      />
                    )}
                    <div className="flex ml-2">
                      <button
                        className="text-green-500 p-1 rounded hover:bg-custom-background-80"
                        onClick={confirmEditing}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </button>
                      <button
                        className="text-custom-text-200 p-1 rounded hover:bg-custom-background-80"
                        onClick={cancelEditing}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div
                      className="flex-grow border border-custom-border-200 rounded px-3 py-1 text-sm cursor-pointer hover:bg-custom-background-80"
                      onClick={() => startEditing(point)}
                    >
                      {isTimeEstimate ? convertMinutesToHoursMinutesString(Number(point.value)) : point.value}
                    </div>
                  </div>
                )}
                {estimatePointError?.[point.key]?.message && (
                  <div className="mt-1 text-xs text-red-500">{estimatePointError[point.key].message}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 새 추정값 추가 버튼 */}
        <button
          className="flex items-center text-sm text-custom-primary hover:text-custom-primary-hover transition-colors"
          onClick={() => {
            // 마지막 키 값 찾기
            const lastKey = Math.max(...estimatePoints.map((p) => p.key), 0);
            // 새 항목 추가
            const newPoints = [
              ...estimatePoints,
              {
                id: undefined,
                key: lastKey + 1,
                value: isTimeEstimate ? "60" : "1", // 기본값 (시간 타입이면 1시간 = 60분)
              },
            ];
            setEstimatePoints(newPoints);
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mr-1"
          >
            <path d="M8 3.33331V12.6666" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12.6667 8L3.33337 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          새 추정값 추가
        </button>
      </div>
    );
  };

  return (
    <ModalCore isOpen={isOpen} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <div className="relative space-y-6 py-5">
        {/* heading */}
        <div className="relative flex justify-between items-center gap-2 px-5">
          <div className="relative flex items-center gap-1">
            {editMode && (
              <div
                onClick={() => {
                  setEstimateSystem((estimate?.type as TEstimateSystemKeys) || EEstimateSystem.POINTS);
                  setEditMode(false);
                  setEstimatePoints(undefined);
                }}
                className="flex-shrink-0 cursor-pointer w-5 h-5 flex justify-center items-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </div>
            )}
            <div className="text-xl font-medium text-custom-text-100">추정 시스템 수정</div>
          </div>
          <div className="text-xs text-gray-400">
            {t("project_settings.estimates.create.step", {
              step: renderEstimateStepsCount,
              total: "2",
            })}
          </div>
        </div>

        {/* estimate steps */}
        <div className="px-5">
          {!editMode ? (
            <EstimateCreateStageOne
              estimateSystem={estimateSystem}
              handleEstimateSystem={setEstimateSystem}
              handleEstimatePoints={handleEstimatePointsSelection}
            />
          ) : (
            renderStageTwo()
          )}
        </div>

        <div className="relative flex justify-end items-center gap-3 px-5 pt-5 border-t border-custom-border-200">
          <Button variant="neutral-primary" size="sm" onClick={handleClose} disabled={buttonLoader}>
            취소
          </Button>
          {editMode && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmitEstimateUpdate()}
              loading={buttonLoader}
              disabled={validateEstimatePointError()}
            >
              {buttonLoader ? "수정 중..." : "추정 시스템 수정"}
            </Button>
          )}
        </div>
      </div>
    </ModalCore>
  );
});
