"use client";

import { FC } from "react";
import { observer } from "mobx-react";
// hooks
import { DoubleCircleIcon } from "@plane/ui";
import { useIssueDetail } from "@/hooks/store";
// components
import { IssueActivityBlockComponent, IssueLink } from ".";
// icons

type TIssueStateActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueStateActivity: FC<TIssueStateActivity> = observer((props) => {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;

  // new_value에서 상태명만 추출 (format: "state_name|{json_data}")
  const newValue = activity.new_value || "";
  const valueParts = newValue.split('|');
  const stateName = valueParts[0] || newValue;

  return (
    <IssueActivityBlockComponent
      icon={<DoubleCircleIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        님이 상태를 <span className="font-medium text-custom-text-100">{stateName}</span> 로 변경했습니다.
        {(() => {
          // 워크플로우 승인 정보 표시 (new_value에서 JSON 데이터 파싱)
          const comment = activity.comment || "";
          const newValue = activity.new_value || "";
          
          // new_value에서 워크플로우 승인 정보 확인 (format: "state_name|{json_data}")
          const valueParts = newValue.split('|');
          
          if (valueParts.length === 2) {
            try {
              const workflowApprovalData = JSON.parse(valueParts[1]);
              
              if (workflowApprovalData && workflowApprovalData.approver_name) {
                const { approver_name, approval_comment, is_self_approval } = workflowApprovalData;
                
                return (
                  <span className="text-custom-text-200">
                    {" "}(
                    {is_self_approval ? "본인 승인" : "승인자"}: <span className="font-medium text-custom-text-100">{approver_name}</span>
                    {approval_comment && (
                      <>, 승인 사유: <span className="font-medium text-custom-text-100">{approval_comment}</span></>
                    )}
                    )
                  </span>
                );
              }
            } catch (e) {
              // JSON 파싱 실패 시 fallback으로 기존 방식 사용
              console.debug("Failed to parse workflow approval data:", e);
            }
          }
          
          // Fallback: 기존 comment 파싱 방식 (영어 및 한국어 지원)
          // 영어 패턴: (approved by Name) - comment 또는 (self-approved by Name) - comment
          const englishApprovalMatch = comment.match(/\((self-)?approved by ([^)]+)\)(?:\s*-\s*(.+))?/);
          
          // 한국어 패턴도 지원할 수 있도록 확장
          const koreanApprovalMatch = comment.match(/\(([^)]*승인[^)]*)\)(?:\s*-\s*(.+))?/);
          
          const approvalMatch = englishApprovalMatch || koreanApprovalMatch;
          
          if (approvalMatch) {
            let approverName, approvalComment, isSelfApproval;
            
            if (englishApprovalMatch) {
              [, isSelfApproval, approverName, approvalComment] = englishApprovalMatch;
            } else if (koreanApprovalMatch) {
              [, approverName, approvalComment] = koreanApprovalMatch;
              isSelfApproval = approverName.includes('본인') || approverName.includes('자가');
            }
            
            return (
              <span className="text-custom-text-200">
                {" "}(
                {isSelfApproval ? "본인 승인자" : "승인자"}: <span className="font-medium text-custom-text-100">{approverName}</span>
                {approvalComment && (
                  <>, 승인 코멘트: <span className="font-medium text-custom-text-100">{approvalComment}</span></>
                )}
                )
              </span>
            );
          }
          return null;
        })()}
        {showIssue ? ` for ` : ``}
        {showIssue && <IssueLink activityId={activityId} />}
      </>
    </IssueActivityBlockComponent>
  );
});
