import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { X, Check } from "lucide-react";
// ui
import { Button, ModalCore, EModalPosition, EModalWidth, ToggleSwitch, Avatar } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import { IWorkflowTransition, IWorkflowTransitionFormData } from "@plane/types";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";
import { useMember } from "@/hooks/store/use-member";
// helpers
import { getFileURL } from "@plane/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  workflowTransition?: IWorkflowTransition | null;
}

export const WorkflowTransitionModal = observer(({ isOpen, onClose, workflowId, workflowTransition }: Props) => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { createWorkflowTransition, updateWorkflowTransition, getWorkflowStates } = useWorkflow();
  const {
    project: { projectMemberIds, getProjectMemberDetails },
    getUserDetails,
  } = useMember();

  // derived values
  const workflowStates = getWorkflowStates(workflowId);

  // 디버깅을 위한 로그
  // React.useEffect(() => {
  //   console.log("Workflow states:", workflowStates);
  // }, [workflowStates]);

  const projectMembers =
    projectMemberIds
      ?.map((userId) => {
        if (!projectId) return null;
        const memberDetails = getProjectMemberDetails(userId, projectId.toString());
        if (!memberDetails?.member) return null;

        return {
          id: memberDetails.member.id,
          display_name: memberDetails.member.display_name,
          avatar_url: memberDetails.member.avatar_url,
          role: memberDetails.role,
        };
      })
      .filter(Boolean) || [];

  // form
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<IWorkflowTransitionFormData>({
    defaultValues: {
      from_state: "",
      to_state: "",
      require_reviewer: false,
      reviewer_ids: [],
    },
  });

  const requireReviewer = watch("require_reviewer");
  const selectedReviewerIds = watch("reviewer_ids") || [];

  React.useEffect(() => {
    // console.log("WorkflowTransition for editing:", workflowTransition);

    if (workflowTransition) {
      const formData = {
        from_state: workflowTransition.from_state_detail?.id || workflowTransition.from_state || "",
        to_state: workflowTransition.to_state_detail?.id || workflowTransition.to_state || "",
        require_reviewer: workflowTransition.require_reviewer || false,
        reviewer_ids: workflowTransition.reviewers?.map((r) => r.reviewer) || [],
      };

      // console.log("Setting transition form data:", formData);
      reset(formData);
    } else {
      reset({
        from_state: "",
        to_state: "",
        require_reviewer: false,
        reviewer_ids: [],
      });
    }
  }, [workflowTransition, reset, isOpen]);

  const onSubmit = async (data: IWorkflowTransitionFormData) => {
    if (!workspaceSlug || !projectId || !workflowId) return;

    // Validation: if require_reviewer is true, reviewer_ids must not be empty
    if (data.require_reviewer && (!data.reviewer_ids || data.reviewer_ids.length === 0)) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "승인자를 최소 1명 선택해주세요.",
      });
      return;
    }

    // 백엔드 API 스펙에 맞게 데이터 변환
    const apiData = {
      from_state: data.from_state, // State 모델의 UUID
      to_state: data.to_state, // State 모델의 UUID
      require_reviewer: data.require_reviewer,
      reviewer_ids: data.reviewer_ids || [],
    };

    try {
      if (workflowTransition) {
        await updateWorkflowTransition(
          workspaceSlug as string,
          projectId as string,
          workflowId,
          workflowTransition.id,
          apiData
        );
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "전환 규칙이 수정되었습니다.",
        });
      } else {
        await createWorkflowTransition(workspaceSlug as string, projectId as string, workflowId, apiData);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "전환 규칙이 추가되었습니다.",
        });
      }
      onClose();
    } catch (error: any) {
      // console.log("Transition error details:", error);
      // console.log("API data sent:", apiData);

      let errorMessage = workflowTransition ? "전환 규칙 수정에 실패했습니다." : "전환 규칙 추가에 실패했습니다.";

      // 409 Conflict - 중복 전환 규칙
      if (error?.status === 409 || error?.response?.status === 409) {
        const responseData = error?.response?.data || error?.data;
        if (responseData?.error) {
          errorMessage = responseData.error;
        } else {
          errorMessage = "이미 존재하는 상태 전환 규칙입니다.";
        }
      }
      // 400 Bad Request - 유효성 검증 실패
      else if (error?.status === 400 || error?.response?.status === 400) {
        const responseData = error?.response?.data || error?.data;
        if (responseData && typeof responseData === "object") {
          const errorMessages = Object.entries(responseData).map(
            ([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`
          );
          if (errorMessages.length > 0) {
            errorMessage = errorMessages.join("; ");
          }
        }
      }

      setToast({
        type: TOAST_TYPE.ERROR,
        title: errorMessage,
      });
    }
  };

  const toggleReviewer = (userId: string) => {
    const current = selectedReviewerIds;
    const isSelected = current.includes(userId);

    if (isSelected) {
      setValue(
        "reviewer_ids",
        current.filter((id) => id !== userId)
      );
    } else {
      setValue("reviewer_ids", [...current, userId]);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="p-5">
        <div className="mb-5">
          <h3 className="text-lg font-medium text-custom-text-100">
            {workflowTransition ? "전환 규칙 수정" : "전환 규칙 추가"}
          </h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 mb-5">
            {/* From State */}
            <div>
              <label htmlFor="from_state" className="block text-sm font-medium text-custom-text-200 mb-2">
                시작 상태 *
              </label>
              <Controller
                name="from_state"
                control={control}
                rules={{ required: "시작 상태를 선택해주세요" }}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-custom-border-300 rounded-md bg-custom-background-100 text-custom-text-100"
                  >
                    <option value="">시작 상태를 선택하세요</option>
                    {workflowStates?.map((state) => (
                      <option key={state.id} value={state.state_detail?.id || state.state}>
                        {state.state_detail?.name} (#{state.sequence})
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.from_state && <p className="mt-1 text-sm text-red-500">{errors.from_state.message}</p>}
            </div>

            {/* To State */}
            <div>
              <label htmlFor="to_state" className="block text-sm font-medium text-custom-text-200 mb-2">
                도착 상태 *
              </label>
              <Controller
                name="to_state"
                control={control}
                rules={{ required: "도착 상태를 선택해주세요" }}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-custom-border-300 rounded-md bg-custom-background-100 text-custom-text-100"
                  >
                    <option value="">도착 상태를 선택하세요</option>
                    {workflowStates?.map((state) => (
                      <option key={state.id} value={state.state_detail?.id || state.state}>
                        {state.state_detail?.name} (#{state.sequence})
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.to_state && <p className="mt-1 text-sm text-red-500">{errors.to_state.message}</p>}
            </div>

            {/* Require Reviewer */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-custom-text-100">승인자 필요</h4>
                <p className="text-sm text-custom-text-200">이 전환에는 승인자가 필요합니다</p>
              </div>
              <Controller
                name="require_reviewer"
                control={control}
                render={({ field: { value, onChange } }) => <ToggleSwitch value={value ?? false} onChange={onChange} />}
              />
            </div>

            {/* Reviewer Selection */}
            {requireReviewer && (
              <div>
                <label className="block text-sm font-medium text-custom-text-200 mb-2">승인자 선택 *</label>
                <div className="border border-custom-border-300 rounded-md p-3 bg-custom-background-100 max-h-60 overflow-y-auto">
                  {projectMembers.length === 0 ? (
                    <p className="text-sm text-custom-text-300 text-center py-4">프로젝트 멤버가 없습니다</p>
                  ) : (
                    <div className="space-y-2">
                      {projectMembers
                        .filter((member) => member !== null)
                        .map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-custom-background-80 cursor-pointer"
                            onClick={() => toggleReviewer(member.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar name={member.display_name} src={getFileURL(member.avatar_url || "")} size="sm" />
                              <span className="text-sm text-custom-text-100">{member.display_name}</span>
                            </div>
                            {selectedReviewerIds.includes(member.id) && <Check className="h-4 w-4 text-green-500" />}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {selectedReviewerIds.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-custom-text-200 mb-2">선택된 승인자 ({selectedReviewerIds.length}명):</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedReviewerIds.map((userId) => {
                        const filteredMembers = projectMembers.filter((m) => m !== null) as Array<{
                          id: any;
                          display_name: any;
                          avatar_url: any;
                          role: any;
                        }>;
                        const member = filteredMembers.find((m) => m.id === userId);
                        if (!member) return null;

                        return (
                          <div
                            key={userId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-custom-primary-100 text-custom-primary-800 rounded-md text-xs"
                          >
                            <Avatar name={member.display_name} src={getFileURL(member.avatar_url || "")} size="sm" />
                            <span>{member.display_name}</span>
                            <button
                              type="button"
                              onClick={() => toggleReviewer(userId)}
                              className="ml-1 hover:text-custom-primary-900"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {requireReviewer && selectedReviewerIds.length === 0 && (
                  <p className="mt-1 text-sm text-red-500">승인자를 최소 1명 선택해주세요</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="neutral-primary" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              {workflowTransition ? "수정" : "추가"}
            </Button>
          </div>
        </form>
      </div>
    </ModalCore>
  );
});
