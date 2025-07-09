import { FC } from "react";
import { observer } from "mobx-react";
import { Signal } from "lucide-react";
// hooks
import { useIssueDetail } from "@/hooks/store";
// components
import { IssueActivityBlockComponent, IssueLink } from ".";

type TIssuePriorityActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssuePriorityActivity: FC<TIssuePriorityActivity> = observer((props) => {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<Signal size={14} className="text-custom-text-200" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        님이 우선순위를 <span className="font-medium text-custom-text-100">{activity.new_value}</span> 로 변경했습니다
        {showIssue ? ` for ` : ``}
        {showIssue && <IssueLink activityId={activityId} />}.
      </>
    </IssueActivityBlockComponent>
  );
});
