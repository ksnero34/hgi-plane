import { observer } from "mobx-react";
import { LabelPropertyIcon } from "@plane/propel/icons";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useLabel } from "@/hooks/store/use-label";
// components
import { IssueActivityBlockComponent, IssueLink, LabelActivityChip } from ".";

type TIssueLabelActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueLabelActivity = observer(function IssueLabelActivity(props: TIssueLabelActivity) {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();
  const { getLabelById } = useLabel();

  const activity = getActivityById(activityId);
  const oldLabelColor = getLabelById(activity?.old_identifier ?? "")?.color;
  const newLabelColor = getLabelById(activity?.new_identifier ?? "")?.color;

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<LabelPropertyIcon height={14} width={14} className="text-custom-text-200" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {activity.old_value === "" ? `님이 새로운 레이블 ` : `님이 레이블 `}
        <LabelActivityChip
          name={activity.old_value === "" ? activity.new_value : activity.old_value}
          color={activity.old_value === "" ? newLabelColor : oldLabelColor}
        />
        {activity.old_value === "" ? ` 을(를) 추가했습니다` : ` 을(를) 삭제했습니다`}
        {showIssue && (activity.old_value === "" ? ` to ` : ` from `)}
        {showIssue && <IssueLink activityId={activityId} />}
      </>
    </IssueActivityBlockComponent>
  );
});
