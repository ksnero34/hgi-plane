import { observer } from "mobx-react";
// hooks
import { StatePropertyIcon } from "@plane/propel/icons";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";
// icons

type TIssueStateActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueStateActivity = observer(function IssueStateActivity(props: TIssueStateActivity) {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;

  // new_value에서 상태명만 추출 (format: "state_name|{json_data}")
  const newValue = activity.new_value || "";
  const valueParts = newValue.split("|");
  const stateName = valueParts[0] || newValue;
  const oldValue = activity.old_value || "";
  const oldStateName = oldValue.split("|")[0] || oldValue;

  const reasonFromComment =
    activity.comment && activity.comment.includes(":") ? activity.comment.split(":").slice(1).join(":").trim() : "";

  const workflowApprovalInfo = (() => {
    // Try parsing structured data embedded in new_value
    if (valueParts.length === 2) {
      try {
        const workflowApprovalData = JSON.parse(valueParts[1]);
        if (workflowApprovalData && workflowApprovalData.approver_name) {
          return {
            approverName: workflowApprovalData.approver_name,
            approvalComment: workflowApprovalData.approval_comment || reasonFromComment,
            isSelfApproval: !!workflowApprovalData.is_self_approval,
          };
        }
      } catch (error) {
        console.debug("Failed to parse workflow approval JSON data:", error);
      }
    }

    const comment = activity.comment || "";
    // English pattern e.g. "(approved by Name) - comment" or "(self-approved by Name) - comment"
    const englishApprovalMatch = comment.match(/\((self-)?approved by ([^)]+)\)(?:\s*-\s*(.+))?/i);
    if (englishApprovalMatch) {
      const [, isSelf, approverName, approvalComment] = englishApprovalMatch;
      return {
        approverName: (approverName || "").trim(),
        approvalComment: approvalComment?.trim() || reasonFromComment,
        isSelfApproval: !!isSelf,
      };
    }

    if (
      comment.toLowerCase().startsWith("approved the state transition") ||
      comment.toLowerCase().startsWith("self-approved the state transition")
    ) {
      return {
        approverName: activity.actor_detail?.display_name || "",
        approvalComment: reasonFromComment,
        isSelfApproval: comment.toLowerCase().startsWith("self-approved"),
      };
    }

    // No workflow approval info available
    return null;
  })();

  const isWorkflowApproval = !!workflowApprovalInfo;

  return (
    <IssueActivityBlockComponent
      icon={<StatePropertyIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {isWorkflowApproval ? (
          <>
            {showIssue ? (
              <>
                <IssueLink activityId={activityId} /> 의 상태를{" "}
              </>
            ) : (
              "이 작업항목의 상태를 "
            )}
            {oldStateName && (
              <>
                <span className="font-medium text-custom-text-100">{oldStateName}</span>
                {"에서 "}
              </>
            )}
            <span className="font-medium text-custom-text-100">{stateName}</span>
            {" (으)로 변경하는 것을 승인했습니다."}
          </>
        ) : (
          <>
            상태를 <span className="font-medium text-custom-text-100">{stateName}</span> 로 변경했습니다.
          </>
        )}
        {workflowApprovalInfo && (
          <span className="text-custom-text-200">
            {" "}
            ({workflowApprovalInfo.isSelfApproval ? "본인 승인" : "승인자"}:{" "}
            <span className="font-medium text-custom-text-100">{workflowApprovalInfo.approverName || "미확인"}</span>
            {workflowApprovalInfo.approvalComment && (
              <>
                , 승인 사유:{" "}
                <span className="font-medium text-custom-text-100">{workflowApprovalInfo.approvalComment}</span>
              </>
            )}
            )
          </span>
        )}
        {!isWorkflowApproval && (
          <>
            {showIssue ? ` for ` : ``}
            {showIssue && <IssueLink activityId={activityId} />}
          </>
        )}
      </>
    </IssueActivityBlockComponent>
  );
});
