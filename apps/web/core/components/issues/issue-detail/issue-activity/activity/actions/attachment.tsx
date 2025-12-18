import { observer } from "mobx-react";
import { Paperclip } from "lucide-react";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";

type TIssueAttachmentActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueAttachmentActivity = observer(function IssueAttachmentActivity(props: TIssueAttachmentActivity) {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
    attachment: { getAttachmentById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);
  const attachmentId = activity?.new_identifier;
  const attachment = attachmentId ? getAttachmentById(attachmentId) : null;

  // 파일 이름 추출 (activity.new_value에서 추출하거나 attachment에서 가져옴)
  const fileName =
    attachment?.attributes?.name || (activity?.new_value ? activity.new_value.split("/").pop() : "첨부파일");

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<Paperclip size={14} className="text-custom-text-200" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {activity.verb === "created" ? `님이 새로운 첨부파일 ` : `님이 첨부파일을 삭제했습니다`}
        {activity.verb === "created" && attachment && (
          <a
            href={attachment.asset_url || `${activity.new_value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-custom-text-100 hover:underline"
          >
            {fileName}
          </a>
        )}
        {activity.verb === "created" && !attachment && (
          <span className="font-medium text-custom-text-100">{fileName}</span>
        )}
        {activity.verb === "created" && <span> 을 업로드 했습니다</span>}
        {showIssue && (activity.verb === "created" ? ` to ` : ` from `)}
        {showIssue && <IssueLink activityId={activityId} />}.
      </>
    </IssueActivityBlockComponent>
  );
});
