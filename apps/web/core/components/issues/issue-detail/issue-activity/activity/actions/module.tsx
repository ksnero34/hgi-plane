"use client";

import { FC } from "react";
import { observer } from "mobx-react";
// hooks
import { DiceIcon } from "@plane/ui";
import { useIssueDetail } from "@/hooks/store";
// components
import { IssueActivityBlockComponent } from ".";
// icons

type TIssueModuleActivity = { activityId: string; ends: "top" | "bottom" | undefined };

export const IssueModuleActivity: FC<TIssueModuleActivity> = observer((props) => {
  const { activityId, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<DiceIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {activity.verb === "created" ? (
          <>
            <span>님이 이 작업항목을 모듈 </span>
            <a
              href={`/${activity.workspace_detail?.slug}/projects/${activity.project}/modules/${activity.new_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate font-medium text-custom-text-100 hover:underline"
            >
              <span className="truncate">{activity.new_value}</span>
            </a> 에 추가했습니다.
          </>
        ) : activity.verb === "updated" ? (
          <>
            <span>님이 모듈을 </span>
            <a
              href={`/${activity.workspace_detail?.slug}/projects/${activity.project}/modules/${activity.new_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate font-medium text-custom-text-100 hover:underline"
            >
              <span className="truncate"> {activity.new_value}</span>
            </a> 
            <span> 로 변경했습니다.</span>
          </>
        ) : (
          <>
            <span>님이 이 작업항목을 모듈 </span>
            <a
              href={`/${activity.workspace_detail?.slug}/projects/${activity.project}/modules/${activity.old_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate font-medium text-custom-text-100 hover:underline"
            >
              <span className="truncate"> {activity.old_value}</span>
            </a> 
            <span> 에서 제외했습니다.</span>
          </>
        )}
      </>
    </IssueActivityBlockComponent>
  );
});
