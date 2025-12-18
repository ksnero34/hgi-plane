import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
// ui
import { Button, Input, ModalCore, EModalPosition, EModalWidth, ToggleSwitch } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import type { IWorkflowState, IWorkflowStateFormData } from "@plane/types";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";
import { useProjectState } from "@/hooks/store/use-project-state";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  workflowState?: IWorkflowState | null;
}

export const WorkflowStateModal = observer(({ isOpen, onClose, workflowId, workflowState }: Props) => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { createWorkflowState, updateWorkflowState } = useWorkflow();
  const { projectStates } = useProjectState();

  // form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IWorkflowStateFormData>({
    defaultValues: {
      state: "",
      sequence: 1,
      allow_new_issues: false,
    },
  });

  React.useEffect(() => {
    // console.log("WorkflowState for editing:", workflowState);

    if (workflowState) {
      const formData = {
        state: workflowState.state_detail?.id || workflowState.state || "",
        sequence: workflowState.sequence || 1,
        allow_new_issues: workflowState.allow_new_issues || false,
      };

      // console.log("Setting form data:", formData);
      reset(formData);
    } else {
      reset({
        state: "",
        sequence: 1,
        allow_new_issues: false,
      });
    }
  }, [workflowState, reset, isOpen]);

  const onSubmit = async (data: IWorkflowStateFormData) => {
    if (!workspaceSlug || !projectId || !workflowId) return;

    // 백엔드 API 스펙에 맞게 데이터 변환
    const apiData = {
      state: data.state, // State 모델의 UUID
      sequence: data.sequence,
      allow_new_issues: data.allow_new_issues,
    };

    try {
      if (workflowState) {
        await updateWorkflowState(workspaceSlug as string, projectId as string, workflowId, workflowState.id, apiData);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "워크플로우 상태가 수정되었습니다.",
        });
      } else {
        await createWorkflowState(workspaceSlug as string, projectId as string, workflowId, apiData);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "워크플로우 상태가 추가되었습니다.",
        });
      }
      onClose();
    } catch (error: any) {
      console.log("Error details:", error);

      let errorMessage = workflowState
        ? "워크플로우 상태 수정에 실패했습니다."
        : "워크플로우 상태 추가에 실패했습니다.";

      // 409 Conflict - 중복 상태나 순서 에러
      if (error?.status === 409 || error?.response?.status === 409) {
        const responseData = error?.response?.data || error?.data;
        if (responseData?.error) {
          errorMessage = responseData.error;
        } else {
          errorMessage = "이미 존재하는 상태이거나 동일한 순서가 있습니다. 다른 순서를 선택해주세요.";
        }
      }
      // 400 Bad Request - 유효성 검증 실패
      else if (error?.status === 400 || error?.response?.status === 400) {
        const responseData = error?.response?.data || error?.data;
        if (responseData && typeof responseData === "object") {
          const errorMessages = Object.values(responseData).flat();
          if (errorMessages.length > 0) {
            errorMessage = errorMessages.join(", ");
          }
        }
      }

      setToast({
        type: TOAST_TYPE.ERROR,
        title: errorMessage,
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="p-5">
        <div className="mb-5">
          <h3 className="text-lg font-medium text-custom-text-100">
            {workflowState ? "워크플로우 상태 수정" : "워크플로우 상태 추가"}
          </h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 mb-5">
            {/* State Selection */}
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-custom-text-200 mb-2">
                프로젝트 상태 선택 *
              </label>
              <Controller
                name="state"
                control={control}
                rules={{ required: "상태를 선택해주세요" }}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-custom-border-300 rounded-md bg-custom-background-100 text-custom-text-100"
                  >
                    <option value="">상태를 선택하세요</option>
                    {projectStates?.map((state) => (
                      <option key={state.id} value={state.id}>
                        {state.name} ({state.group})
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.state && <p className="mt-1 text-sm text-red-500">{errors.state.message}</p>}
            </div>

            {/* Sequence */}
            <div>
              <label htmlFor="sequence" className="block text-sm font-medium text-custom-text-200 mb-2">
                순서 *
              </label>
              <Controller
                name="sequence"
                control={control}
                rules={{ required: "순서를 입력해주세요", min: { value: 1, message: "1 이상의 값을 입력해주세요" } }}
                render={({ field }) => (
                  <Input {...field} type="number" placeholder="순서를 입력하세요" hasError={!!errors.sequence} />
                )}
              />
              {errors.sequence && <p className="mt-1 text-sm text-red-500">{errors.sequence.message}</p>}
            </div>

            {/* Allow New Issues */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-custom-text-100">새 이슈 허용</h4>
                <p className="text-sm text-custom-text-200">이 상태에서 새 이슈를 생성할 수 있습니다</p>
              </div>
              <Controller
                name="allow_new_issues"
                control={control}
                render={({ field: { value, onChange } }) => <ToggleSwitch value={value ?? false} onChange={onChange} />}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="neutral-primary" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              {workflowState ? "수정" : "추가"}
            </Button>
          </div>
        </form>
      </div>
    </ModalCore>
  );
});
