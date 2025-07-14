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
  return (
    <IssueActivityBlockComponent
      icon={<DoubleCircleIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        님이 상태를 <span className="font-medium text-custom-text-100">{activity.new_value}</span> 로 변경했습니다.
        {(() => {
          // 워크플로우 승인 정보 파싱
          const comment = activity.comment || "";
          const approvalMatch = comment.match(/\(approved by ([^)]+)\)(?:\s*-\s*(.+))?/);
          
          if (approvalMatch) {
            const [, approverName, approvalComment] = approvalMatch;
            return (
              <span className="text-custom-text-200">
                {" "}(승인자: <span className="font-medium text-custom-text-100">{approverName}</span>
                {approvalComment && (
                  <>, 승인 코멘트: <span className="font-medium text-custom-text-100">{approvalComment}</span></>
                )})
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
