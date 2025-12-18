import { observer } from "mobx-react";
// hooks
import { CycleIcon } from "@plane/propel/icons";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent } from "./";
// icons

type TIssueCycleActivity = { activityId: string; ends: "top" | "bottom" | undefined };

export const IssueCycleActivity = observer(function IssueCycleActivity(props: TIssueCycleActivity) {
  const { activityId, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<CycleIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {activity.verb === "created" ? (
          <>
            <span>님이 이 작업항목을 주기 </span>
            <a
              href={`/${activity.workspace_detail?.slug}/projects/${activity.project}/cycles/${activity.new_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate font-medium text-custom-text-100 hover:underline"
            >
              <span className="truncate">{activity.new_value}</span>
            </a>
            <span> 에 추가했습니다.</span>
          </>
        ) : activity.verb === "updated" ? (
          <>
            <span>님이 주기를 </span>
            <a
              href={`/${activity.workspace_detail?.slug}/projects/${activity.project}/cycles/${activity.new_identifier}`}
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
            <span>님이 이 작업항목을 주기에서 제외했습니다.</span>
            <a
              href={`/${activity.workspace_detail?.slug}/projects/${activity.project}/cycles/${activity.old_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate font-medium text-custom-text-100 hover:underline"
            >
              <span className="truncate"> {activity.new_value}</span>
            </a>
          </>
        )}
      </>
    </IssueActivityBlockComponent>
  );
});
