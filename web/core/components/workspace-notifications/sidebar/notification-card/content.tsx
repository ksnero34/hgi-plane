import { FC } from "react";
import { TNotification } from "@plane/types";
// components
import { LiteTextReadOnlyEditor } from "@/components/editor";
// helpers
import { convertMinutesToHoursMinutesString, renderFormattedDate } from "@/helpers/date-time.helper";
import { sanitizeCommentForNotification } from "@/helpers/notification.helper";
import { replaceUnderscoreIfSnakeCase, stripAndTruncateHTML } from "@/helpers/string.helper";

export const NotificationContent: FC<{
  notification: TNotification;
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  renderCommentBox?: boolean;
}> = ({ notification, workspaceId, workspaceSlug, projectId, renderCommentBox = false }) => {
  const { data, triggered_by_details: triggeredBy } = notification;
  const notificationField = data?.issue_activity.field;
  const newValue = data?.issue_activity.new_value;
  const oldValue = data?.issue_activity.old_value;
  const verb = data?.issue_activity.verb;

  const renderTriggerName = () => (
    <span className="text-custom-text-100 font-medium">
      {triggeredBy?.is_bot ? triggeredBy.first_name : triggeredBy?.display_name}{" "}
    </span>
  );

  const renderAction = () => {
    if (!notificationField) return "";
    if (notificationField === "duplicate")
      return verb === "created"
        ? "님이 이 작업항목이 다음 작업항목의 중복임으로 표시했습니다"
        : "님이 이 작업항목이 다음 작업항목의 중복임 표시를 제거했습니다";
    if (notificationField === "assignees") {
      return newValue !== "" ? "님이 작업항목에" : "님이 작업항목에";
    }
    if (notificationField === "start_date") {
      return newValue !== "" ? "님이 작업항목의 시작일을" : "님이 작업항목의 시작일을 제거했습니다";
    }
    if (notificationField === "target_date") {
      return newValue !== "" ? "님이 작업항목의 완료일을" : "님이 작업항목의 완료일을 제거했습니다";
    }
    if (notificationField === "labels") {
      return newValue !== "" ? "님이 작업항목에 라벨" : "님이 작업항목에 라벨";
    }
    if (notificationField === "parent") {
      return newValue !== "" ? "님이 작업항목의 상위 작업항목을" : "님이 작업항목의 상위 작업항목을 제거했습니다";
    }
    if (notificationField === "cycles") {
      return newValue !== "" ? "님이 작업항목에 주기" : "님이 작업항목에 주기를 삭제했습니다.";
    }
    if (notificationField === "priority") {
      return newValue !== "" ? "님이 작업항목의 우선순위를" : "님이 작업항목의 우선순위를 제거했습니다";
    }
    if (notificationField === "state") {
      if (data?.issue?.state_group === "completed") return "님이 작업항목을";
      return newValue !== "" ? "님이 작업항목의 상태를" : "님이 작업항목의 상태를 변경했습니다";
    }
    if (notificationField === "estimate_time") {
      return newValue !== "" ? "님이 작업항목의 예상시간을" : "님이 작업항목의 예상시간을 제거했습니다";
    }
    if (notificationField === "relates_to") return "님이 작업항목이 다음 작업항목과 관련있음으로 표시했습니다";
    if (notificationField === "comment") return "님이 댓글을 남겼습니다.";
    if (notificationField === "archived_at") {
      return newValue === "restore" ? "님이 작업항목을 복구했습니다" : "님이 작업항목을 보관했습니다";
    }
    if (notificationField === "None") return "님이 작업항목을 생성하고 당신을 담당자로 할당했습니다.";

    const baseAction = !["comment", "archived_at"].includes(notificationField) ? verb : "";
    return `${baseAction} ${replaceUnderscoreIfSnakeCase(notificationField)}`;
  };

  const renderValue = () => {
    if (notificationField === "None") return null;
    if (notificationField === "comment") return renderCommentBox ? null : sanitizeCommentForNotification(newValue);
    if (notificationField === "target_date" || notificationField === "start_date") return renderFormattedDate(newValue);
    if (notificationField === "attachment") return "작업항목";
    if (notificationField === "description") return stripAndTruncateHTML(newValue || "", 55);
    if (notificationField === "archived_at") return null;
    if (notificationField === "assignees") return newValue !== "" ? newValue : oldValue;
    if (notificationField === "labels") return newValue !== "" ? newValue : oldValue;
    if (notificationField === "parent") return newValue !== "" ? newValue : oldValue;
    if (notificationField === "cycles") return newValue !== "" ? newValue : null;
    if (notificationField === "priority") return newValue !== "" ? newValue : null;
    if (notificationField === "state") return newValue !== "" ? newValue : null;
    if (notificationField === "estimate_time")
      return newValue !== ""
        ? convertMinutesToHoursMinutesString(Number(newValue))
        : convertMinutesToHoursMinutesString(Number(oldValue));
    return newValue;
  };

  const renderSuffix = () => {
    if (notificationField === "priority") return " 로 변경했습니다.";
    if (notificationField === "state") {
      if (data?.issue?.state_group === "completed") return " 로 변경하여 완료처리했습니다.";
      else return " 로 변경했습니다.";
    }
    if (notificationField === "estimate_time") return " 로 변경했습니다.";
    if (notificationField === "start_date") {
      if (newValue !== "") return " 로 설정했습니다.";
    }
    if (notificationField === "target_date") {
      if (newValue !== "") return " 로 설정했습니다.";
    }
    if (notificationField === "labels") {
      if (newValue !== "") return " 를 추가했습니다.";
      else return " 를 제거했습니다.";
    }
    if (notificationField === "assignees") {
      if (newValue !== "") return " 님을 담당자로 추가했습니다.";
      else return " 님을 담당자에서 제외 했습니다.";
    }
    if (notificationField === "parent") return " 추가했습니다.";
    if (notificationField === "cycles") {
      if (newValue !== "") return " 를 추가했습니다.";
    }
    
    return "";
  };

  const needsValueDisplay = ![
    "None", "archived_at"
  ].includes(notificationField || "");

  // 마침표가 필요없는 필드 목록
  const fieldsWithCustomSuffix = [
    "priority", "state", "estimate_time", "start_date", "target_date", 
    "labels", "assignees", "parent", "cycles"
  ];

  return (
    <>
      {renderTriggerName()}
      <span className="text-custom-text-300">{renderAction()} </span>
      {verb !== "deleted" && needsValueDisplay && (
        <>
          <span className="text-custom-text-100 font-medium">{renderValue()}</span>
          <span className="text-custom-text-300">{renderSuffix()}</span>
          {notificationField === "comment" && renderCommentBox && (
            <div className="scale-75 origin-left">
              <LiteTextReadOnlyEditor
                id=""
                initialValue={newValue ?? ""}
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
              />
            </div>
          )}
          {!fieldsWithCustomSuffix.includes(notificationField || "") && "."}
        </>
      )}
    </>
  );
};
