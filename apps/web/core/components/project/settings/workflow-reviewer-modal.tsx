import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Shield, User } from "lucide-react";
// ui
import { Button, ModalCore, EModalPosition, EModalWidth, TextArea } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import type { IWorkflowValidation, IWorkflowValidationResponse } from "@plane/types";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transitionData: {
    issueId: string;
    fromStateId: string;
    toStateId: string;
    reviewers: string[];
    transitionId?: string;
    approvalRequestId?: string;
  } | null;
  projectId?: string;
  onApprove: () => void;
}

interface ReviewFormData {
  comment: string;
  approved: boolean;
}

export const WorkflowReviewerModal = observer(
  ({ isOpen, onClose, transitionData, projectId: propProjectId, onApprove }: Props) => {
    // router
    const { workspaceSlug, projectId: paramProjectId } = useParams();

    // Use prop projectId if available, otherwise fall back to param projectId
    const projectId = propProjectId || paramProjectId;
    // store hooks
    const { executeTransition, approveTransition, requestApproval } = useWorkflow();
    const { getUserDetails } = useMember();
    const { data: currentUser } = useUser();

    // form
    const {
      control,
      handleSubmit,
      reset,
      formState: { isSubmitting },
    } = useForm<ReviewFormData>({
      defaultValues: {
        comment: "",
        approved: false,
      },
    });

    React.useEffect(() => {
      if (isOpen) {
        reset({
          comment: "",
          approved: false,
        });
      }
    }, [isOpen, reset]);

    const onSubmit = async (data: ReviewFormData) => {
      console.log("onSubmit called with data:", data);
      console.log("workspaceSlug:", workspaceSlug, "projectId:", projectId, "transitionData:", transitionData);

      if (!workspaceSlug || !projectId || !transitionData) {
        console.log("Missing required data, returning early");
        return;
      }

      try {
        // Check if this is an existing approval request that needs to be processed
        if (transitionData.approvalRequestId && isCurrentUserReviewer) {
          // This is an existing approval request - approve it
          if (!data.approved) {
            setToast({
              type: TOAST_TYPE.ERROR,
              title: "승인이 필요합니다",
              message: "상태 전환을 진행하려면 승인이 필요합니다.",
            });
            return;
          }

          await approveTransition(workspaceSlug as string, projectId as string, transitionData.approvalRequestId, {
            comment: data.comment,
          });

          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: "상태 전환 승인됨",
            message: "상태가 성공적으로 변경되었습니다.",
          });

          onApprove();
        } else {
          // Always create an approval request first, regardless of reviewer status
          console.log("Creating approval request for:", {
            workspaceSlug,
            projectId,
            payload: {
              issue_id: transitionData.issueId,
              from_state_id: transitionData.fromStateId,
              to_state_id: transitionData.toStateId,
              comment: data.comment,
            },
          });

          const approvalResult = await requestApproval(workspaceSlug as string, projectId as string, {
            issue_id: transitionData.issueId,
            from_state_id: transitionData.fromStateId,
            to_state_id: transitionData.toStateId,
            comment: data.comment,
          });

          console.log("requestApproval result:", approvalResult);

          // Check if this is an existing approval request
          if (approvalResult.message && approvalResult.message.includes("already exists")) {
            setToast({
              type: TOAST_TYPE.INFO,
              title: "승인 요청 이미 존재",
              message: "이 상태 전환에 대한 승인 요청이 이미 존재합니다. 검토자의 승인을 기다려주세요.",
            });
          } else {
            if (isCurrentUserReviewer) {
              setToast({
                type: TOAST_TYPE.SUCCESS,
                title: "승인 요청 생성됨",
                message: "승인 요청이 생성되었습니다. 워크플로우 승인 모달에서 검토해주세요.",
              });
            } else {
              setToast({
                type: TOAST_TYPE.SUCCESS,
                title: "승인 요청됨",
                message: "상태 전환 승인 요청이 검토자에게 전송되었습니다.",
              });
            }
          }
        }

        onClose();
      } catch (error: any) {
        console.error("Error in workflow modal:", error);
        console.error("Error details:", {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
          stack: error?.stack,
        });

        // Handle specific error cases
        if (!isCurrentUserReviewer && error?.response?.data?.message === "Approval request already exists") {
          setToast({
            type: TOAST_TYPE.INFO,
            title: "승인 요청 이미 존재",
            message: "이 상태 전환에 대한 승인 요청이 이미 존재합니다. 검토자의 승인을 기다려주세요.",
          });
          onClose();
          return;
        }

        // Default error handling
        setToast({
          type: TOAST_TYPE.ERROR,
          title: isCurrentUserReviewer ? "상태 전환 실패" : "승인 요청 실패",
          message: isCurrentUserReviewer ? "상태 전환 중 오류가 발생했습니다." : "승인 요청 중 오류가 발생했습니다.",
        });
      }
    };

    const reviewers = transitionData?.reviewers?.map((reviewerId) => getUserDetails(reviewerId)) || [];

    // Check if current user is a reviewer
    const isCurrentUserReviewer = (currentUser?.id && transitionData?.reviewers?.includes(currentUser.id)) || false;

    return (
      <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
        <div
          className="p-5"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div className="mb-5">
            <h3 className="text-lg font-medium text-custom-text-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              {transitionData?.approvalRequestId && isCurrentUserReviewer
                ? "상태 전환 승인 검토"
                : "상태 전환 승인 요청"}
            </h3>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            onClick={(e) => {
              e.stopPropagation();
              console.log("Form clicked");
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="space-y-4 mb-5">
              <div className="rounded-md bg-yellow-50 p-4">
                <div className="flex">
                  <Shield className="h-5 w-5 text-yellow-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      {transitionData?.approvalRequestId && isCurrentUserReviewer
                        ? "승인 검토가 필요한 상태 전환"
                        : "승인 요청할 상태 전환"}
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        {transitionData?.approvalRequestId && isCurrentUserReviewer
                          ? "이미 생성된 승인 요청을 검토하고 승인 여부를 결정해주세요."
                          : "이 상태 전환은 검토자의 승인이 필요합니다. 승인 요청을 생성하시겠습니까?"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reviewers */}
              <div>
                <h4 className="text-sm font-medium text-custom-text-100 mb-2">
                  {transitionData?.approvalRequestId && isCurrentUserReviewer ? "승인자" : "검토자"}
                </h4>
                <div className="space-y-2">
                  {reviewers.map((reviewer) => (
                    <div key={reviewer?.id} className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-custom-text-300" />
                      <span className="text-sm text-custom-text-100">{reviewer?.display_name || "Unknown User"}</span>
                      {isCurrentUserReviewer && reviewer?.id === currentUser?.id && (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">나</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-custom-text-200 mb-2">
                  {transitionData?.approvalRequestId && isCurrentUserReviewer
                    ? "승인 코멘트 (선택사항)"
                    : "요청 사유 (선택사항)"}
                </label>
                <Controller
                  name="comment"
                  control={control}
                  render={({ field }) => (
                    <TextArea
                      {...field}
                      placeholder={
                        transitionData?.approvalRequestId && isCurrentUserReviewer
                          ? "승인에 대한 코멘트를 입력하세요..."
                          : "승인 요청 사유를 입력하세요..."
                      }
                      rows={3}
                    />
                  )}
                />
              </div>

              {/* Approval Checkbox - Only show for existing approval requests */}
              {transitionData?.approvalRequestId && isCurrentUserReviewer && (
                <div className="flex items-start space-x-3">
                  <Controller
                    name="approved"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={onChange}
                        className="mt-1 h-4 w-4 text-custom-primary-600 focus:ring-custom-primary-500 border-custom-border-300 rounded"
                      />
                    )}
                  />
                  <div>
                    <label className="text-sm font-medium text-custom-text-100">이 상태 전환을 승인합니다</label>
                    <p className="text-sm text-custom-text-200">체크하시면 이슈의 상태가 변경됩니다.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="neutral-primary" onClick={onClose}>
                취소
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={isSubmitting}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("Submit button clicked", e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {transitionData?.approvalRequestId && isCurrentUserReviewer ? "승인 및 전환" : "승인 요청"}
              </Button>
            </div>
          </form>
        </div>
      </ModalCore>
    );
  }
);
