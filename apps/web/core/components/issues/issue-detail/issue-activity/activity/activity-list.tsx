import { observer } from "mobx-react";
// helpers
import { getValidKeysFromObject } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// plane web components
import { IssueTypeActivity, AdditionalActivityRoot } from "@/plane-web/components/issues/issue-details";
import { useTimeLineRelationOptions } from "@/plane-web/components/relations";
// types
import type { TCustomField } from "@plane/types";
// local components
import {
  IssueDefaultActivity,
  IssueNameActivity,
  IssueDescriptionActivity,
  IssueStateActivity,
  IssueAssigneeActivity,
  IssuePriorityActivity,
  IssueEstimateActivity,
  IssueParentActivity,
  IssueRelationActivity,
  IssueStartDateActivity,
  IssueTargetDateActivity,
  IssueCycleActivity,
  IssueModuleActivity,
  IssueLabelActivity,
  IssueLinkActivity,
  IssueAttachmentActivity,
  IssueArchivedAtActivity,
  IssueInboxActivity,
  IssueCustomFieldActivity,
} from "./actions";

type TIssueActivityItem = {
  activityId: string;
  ends: "top" | "bottom" | undefined;
  customFields?: TCustomField[];
};

export const IssueActivityItem = observer(function IssueActivityItem(props: TIssueActivityItem) {
  const { activityId, ends, customFields = [] } = props;
  // hooks
  const {
    activity: { getActivityById },
    comment: {},
  } = useIssueDetail();
  const ISSUE_RELATION_OPTIONS = useTimeLineRelationOptions();
  const activityRelations = getValidKeysFromObject(ISSUE_RELATION_OPTIONS);

  const componentDefaultProps = { activityId, ends };

  const activityField = getActivityById(activityId)?.field;

  // 커스텀 필드 activity 처리
  if (activityField?.startsWith("custom_field_")) {
    return <IssueCustomFieldActivity {...componentDefaultProps} showIssue={false} customFields={customFields} />;
  }

  switch (activityField) {
    case null: // default issue creation
      return <IssueDefaultActivity {...componentDefaultProps} />;
    case "state":
      return <IssueStateActivity {...componentDefaultProps} showIssue={false} />;
    case "name":
      return <IssueNameActivity {...componentDefaultProps} />;
    case "description":
      return <IssueDescriptionActivity {...componentDefaultProps} showIssue={false} />;
    case "assignees":
      return <IssueAssigneeActivity {...componentDefaultProps} showIssue={false} />;
    case "priority":
      return <IssuePriorityActivity {...componentDefaultProps} showIssue={false} />;
    case "estimate_points":
    case "estimate_categories":
    case "estimate_point" /* This case is to handle all the older recorded activities for estimates. Field changed from  "estimate_point" -> `estimate_${estimate_type}`*/:
    case "estimate_time" /* 시간 추정 타입을 위한 처리 추가 */:
      return <IssueEstimateActivity {...componentDefaultProps} showIssue={false} />;
    case "parent":
      return <IssueParentActivity {...componentDefaultProps} showIssue={false} />;
    case activityRelations.find((field) => field === activityField):
      return <IssueRelationActivity {...componentDefaultProps} />;
    case "start_date":
      return <IssueStartDateActivity {...componentDefaultProps} showIssue={false} />;
    case "target_date":
      return <IssueTargetDateActivity {...componentDefaultProps} showIssue={false} />;
    case "cycles":
      return <IssueCycleActivity {...componentDefaultProps} />;
    case "modules":
      return <IssueModuleActivity {...componentDefaultProps} />;
    case "labels":
      return <IssueLabelActivity {...componentDefaultProps} showIssue={false} />;
    case "link":
      return <IssueLinkActivity {...componentDefaultProps} showIssue={false} />;
    case "attachment":
      return <IssueAttachmentActivity {...componentDefaultProps} showIssue={false} />;
    case "archived_at":
      return <IssueArchivedAtActivity {...componentDefaultProps} />;
    case "intake":
    case "inbox":
      return <IssueInboxActivity {...componentDefaultProps} />;
    case "type":
      return <IssueTypeActivity {...componentDefaultProps} />;
    default:
      return <AdditionalActivityRoot {...componentDefaultProps} field={activityField} />;
  }
});
