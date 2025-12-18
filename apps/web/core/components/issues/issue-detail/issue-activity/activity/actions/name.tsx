import { observer } from "mobx-react";
import { Type } from "lucide-react";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent } from ".";

type TIssueNameActivity = { activityId: string; ends: "top" | "bottom" | undefined };

export const IssueNameActivity = observer(function IssueNameActivity(props: TIssueNameActivity) {
  const { activityId, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<Type size={14} className="text-custom-text-200" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        님이 제목을 <span className="font-medium text-custom-text-100">{activity.new_value}</span> 로 변경했습니다.
      </>
    </IssueActivityBlockComponent>
  );
});
