"use client";

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Shield, User } from "lucide-react";
// ui
import { Button, ModalCore, EModalPosition, EModalWidth, TextArea, setToast, TOAST_TYPE } from "@plane/ui";
// types
import { IWorkflowValidation, IWorkflowValidationResponse } from "@plane/types";
// hooks
import { useWorkflow, useMember } from "@/hooks/store";

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
  onApprove: () => void;
}

interface ReviewFormData {
  comment: string;
  approved: boolean;
}

export const WorkflowReviewerModal = observer(({ isOpen, onClose, transitionData, onApprove }: Props) => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { executeTransition, approveTransition } = useWorkflow();
  const { getUserDetails } = useMember();
  
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
    if (!workspaceSlug || !projectId || !transitionData) return;

    if (!data.approved) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "승인이 필요합니다",
        message: "상태 전환을 진행하려면 승인이 필요합니다.",
      });
      return;
    }

    try {
      // Use approveTransition if this is an approval request, otherwise use executeTransition
      if (transitionData.approvalRequestId) {
        await approveTransition(
          workspaceSlug as string, 
          projectId as string, 
          transitionData.approvalRequestId, 
          {
            comment: data.comment,
          }
        );
      } else {
        await executeTransition(workspaceSlug as string, projectId as string, {
          issue_id: transitionData.issueId,
          from_state_id: transitionData.fromStateId,
          to_state_id: transitionData.toStateId,
          comment: data.comment,
        });
      }
      
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "상태 전환 승인됨",
        message: "상태가 성공적으로 변경되었습니다.",
      });
      
      onApprove();
      onClose();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "상태 전환 실패",
        message: "상태 전환 중 오류가 발생했습니다.",
      });
    }
  };

  const reviewers = transitionData?.reviewers?.map(reviewerId => getUserDetails(reviewerId)) || [];

  return (
    <ModalCore
      isOpen={isOpen}
      handleClose={onClose}
      position={EModalPosition.CENTER}
      width={EModalWidth.XL}
    >
      <div className="p-5">
        <div className="mb-5">
          <h3 className="text-lg font-medium text-custom-text-100 flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            상태 전환 승인 필요
          </h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 mb-5">
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="flex">
                <Shield className="h-5 w-5 text-yellow-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    승인이 필요한 상태 전환
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>이 상태 전환은 워크플로우 규칙에 따라 승인이 필요합니다.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reviewers */}
            <div>
              <h4 className="text-sm font-medium text-custom-text-100 mb-2">승인자</h4>
              <div className="space-y-2">
                {reviewers.map((reviewer) => (
                  <div key={reviewer?.id} className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-custom-text-300" />
                    <span className="text-sm text-custom-text-100">
                      {reviewer?.display_name || "Unknown User"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-custom-text-200 mb-2">
                승인 코멘트 (선택사항)
              </label>
              <Controller
                name="comment"
                control={control}
                render={({ field }) => (
                  <TextArea
                    {...field}
                    placeholder="승인에 대한 코멘트를 입력하세요..."
                    rows={3}
                  />
                )}
              />
            </div>

            {/* Approval Checkbox */}
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
                <label className="text-sm font-medium text-custom-text-100">
                  이 상태 전환을 승인합니다
                </label>
                <p className="text-sm text-custom-text-200">
                  체크하시면 이슈의 상태가 변경됩니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="neutral-primary" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              승인 및 전환
            </Button>
          </div>
        </form>
      </div>
    </ModalCore>
  );
});