import { observer } from "mobx-react";
import { EstimatePropertyIcon } from "@plane/propel/icons";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";
// utilities
import { convertMinutesToHoursMinutesString } from "@plane/utils";

type TIssueEstimateActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueEstimateActivity = observer(function IssueEstimateActivity(props: TIssueEstimateActivity) {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;

  const getEstimateLabel = (field?: string | null) => {
    if (!field) return "소요자원";

    if (field.includes("time")) return "소요시간";
    if (field.includes("points")) return "포인트";
    if (field.includes("categories")) return "카테고리";

    return "소요자원";
  };

  const estimateLabel = getEstimateLabel(activity.field);

  // 시간 타입일 경우 분 단위를 시간:분 형식으로 변환
  const formatEstimateValue = (value: string | null, field?: string | null) => {
    if (!value) return "";

    // 시간 추정값인 경우 분 단위를 시간:분 형식으로 변환
    if (field && field.includes("time")) {
      return convertMinutesToHoursMinutesString(Number(value)).trim();
    }

    return value;
  };

  const formattedNewValue = formatEstimateValue(activity.new_value ?? null, activity.field);
  const formattedOldValue = formatEstimateValue(activity.old_value ?? null, activity.field);

  return (
    <IssueActivityBlockComponent
      icon={<EstimatePropertyIcon className="h-3.5 w-3.5 text-custom-text-200" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {activity.new_value ? `님이 ${estimateLabel}을 ` : `님이 ${estimateLabel}을 삭제했습니다`}
        {activity.new_value ? formattedNewValue : formattedOldValue}
        {activity.new_value ? ` 으로 변경했습니다` : ``}
        {showIssue && (activity.new_value ? ` to ` : ` from `)}
        {showIssue && <IssueLink activityId={activityId} />}.
      </>
    </IssueActivityBlockComponent>
  );
});
