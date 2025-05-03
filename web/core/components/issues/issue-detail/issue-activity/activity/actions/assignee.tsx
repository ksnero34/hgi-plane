import { FC } from "react";
import { observer } from "mobx-react";
// icons
import { Users } from "lucide-react";
// hooks;
import { useIssueDetail } from "@/hooks/store";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";

type TIssueAssigneeActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueAssigneeActivity: FC<TIssueAssigneeActivity> = observer((props) => {
  const { activityId, ends, showIssue = true } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<Users className="h-3.5 w-3.5 flex-shrink-0 text-custom-text-200" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {activity.old_value === "" ? `님이 새로운 담당자 ` : `님이 담당자 `}
        <a
          href={`/${activity.workspace_detail?.slug}/profile/${activity.new_identifier ?? activity.old_identifier}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center font-medium text-custom-text-100 hover:underline capitalize"
        >
          {activity.new_value && activity.new_value !== "" ? activity.new_value : activity.old_value}
        </a>
        {activity.old_value === "" ? ` 님을 추가했습니다` : ` 님을 삭제했습니다`}
        {showIssue && (activity.old_value === "" ? ` to ` : ` from `)}
        {showIssue && <IssueLink activityId={activityId} />}.
      </>
    </IssueActivityBlockComponent>
  );
});
