import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// store hooks
// icons
import {
  TagIcon,
  CopyPlus,
  Calendar,
  Link2Icon,
  Users2Icon,
  ArchiveIcon,
  PaperclipIcon,
  ContrastIcon,
  TriangleIcon,
  LayoutGridIcon,
  SignalMediumIcon,
  MessageSquareIcon,
  UsersIcon,
  CalendarDays,
  Users,
  User,
} from "lucide-react";
import { IIssueActivity, TCustomField } from "@plane/types";
import {
  BlockedIcon,
  BlockerIcon,
  CycleIcon,
  EpicIcon,
  IntakeIcon,
  ModuleIcon,
  RelatedIcon,
  WorkItemsIcon,
} from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";

// helpers
import { renderFormattedDate, generateWorkItemLink, capitalizeFirstLetter } from "@plane/utils";
import { convertMinutesToHoursMinutesString } from "@plane/utils";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { usePlatformOS } from "@/hooks/use-platform-os";
// types

export function IssueLink({ activity }: { activity: IIssueActivity }) {
  // router params
  const { workspaceSlug } = useParams();
  const { isMobile } = usePlatformOS();

  const workItemLink = generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString() ?? activity.workspace_detail?.slug,
    projectId: activity?.project,
    issueId: activity?.issue,
    projectIdentifier: activity?.project_detail?.identifier,
    sequenceId: activity?.issue_detail?.sequence_id,
  });

  return (
    <Tooltip
      tooltipContent={activity?.issue_detail ? activity.issue_detail.name : "This work item has been deleted"}
      isMobile={isMobile}
    >
      {activity?.issue_detail ? (
        <a
          aria-disabled={activity.issue === null}
          href={workItemLink}
          target={activity.issue === null ? "_self" : "_blank"}
          rel={activity.issue === null ? "" : "noopener noreferrer"}
          className="inline items-center gap-1 font-medium text-custom-text-100 hover:underline"
        >
          <span className="whitespace-nowrap">{`${activity.project_detail.identifier}-${activity.issue_detail.sequence_id}`}</span>{" "}
          <span className="font-normal break-all">{activity.issue_detail?.name}</span>
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 font-medium text-custom-text-100 whitespace-nowrap">
          {" a work item"}{" "}
        </span>
      )}
    </Tooltip>
  );
}

function UserLink({ activity }: { activity: IIssueActivity }) {
  // router params
  const { workspaceSlug } = useParams();

  return (
    <a
      href={`/${workspaceSlug ?? activity.workspace_detail?.slug}/profile/${
        activity.new_identifier ?? activity.old_identifier
      }`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center font-medium text-custom-text-100 hover:underline"
    >
      {activity.new_value && activity.new_value !== "" ? activity.new_value : activity.old_value}
    </a>
  );
}

const LabelPill = observer(function LabelPill({ labelId, workspaceSlug }: { labelId: string; workspaceSlug: string }) {
  // store hooks
  const { workspaceLabels, fetchWorkspaceLabels } = useLabel();

  useEffect(() => {
    if (!workspaceLabels) fetchWorkspaceLabels(workspaceSlug);
  }, [fetchWorkspaceLabels, workspaceLabels, workspaceSlug]);

  return (
    <span
      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
      style={{
        backgroundColor: workspaceLabels?.find((l) => l.id === labelId)?.color ?? "#000000",
      }}
      aria-hidden="true"
    />
  );
});

// 커스텀 필드 타입별 아이콘 반환
const getCustomFieldIcon = (fieldType: string) => {
  switch (fieldType) {
    case "text":
      return <MessageSquareIcon size={12} className="text-custom-text-200" aria-hidden="true" />; // text 아이콘
    case "date":
      return <Calendar size={12} className="text-custom-text-200" aria-hidden="true" />; // due date 아이콘
    case "project_member":
      return <User size={12} className="text-custom-text-200" aria-hidden="true" />; // created by 아이콘
    case "project_members":
      return <Users2Icon size={12} className="text-custom-text-200" aria-hidden="true" />; // assignees 아이콘
    case "select":
    case "multiselect":
    default:
      return <TagIcon size={12} className="text-custom-text-200" aria-hidden="true" />; // labels 아이콘
  }
};

// 커스텀 필드 값 포맷팅 함수
const formatCustomFieldValue = (
  value: string | null,
  fieldType: string,
  workspaceSlug: string,
  projectId: string,
  memberHook: any,
  activity?: IIssueActivity
): React.ReactNode => {
  if (!value) return "없음";

  const {
    project: { getProjectMemberDetails, getProjectMemberIds },
  } = memberHook;

  if (fieldType === "project_member") {
    // 단일 멤버인 경우 - 백엔드에서 UUID를 받음
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    if (isUUID) {
      // UUID인 경우 멤버 정보 조회
      const memberDetails = getProjectMemberDetails(value, projectId);
      const displayName = memberDetails?.member?.display_name || value;

      return (
        <a
          href={`/${workspaceSlug}/profile/${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center font-medium text-custom-text-100 hover:underline"
        >
          {displayName}
        </a>
      );
    } else {
      // UUID가 아닌 경우 (레거시 데이터) 일반 텍스트로 표시
      return <span className="font-medium text-custom-text-100">{value}</span>;
    }
  } else if (fieldType === "project_members") {
    // 다중 멤버인 경우 - 백엔드에서 UUID 배열을 JSON으로 받음
    let memberIds: string[] = [];

    try {
      // JSON 배열 형태인지 확인
      if (value.startsWith("[") && value.endsWith("]")) {
        memberIds = JSON.parse(value);
      } else {
        // 단일 값인 경우
        memberIds = [value.trim()];
      }
    } catch {
      // JSON 파싱 실패 시 단일 값으로 처리
      memberIds = [value.trim()];
    }

    return memberIds.map((memberId, index) => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

      if (isUUID) {
        // UUID인 경우 멤버 정보 조회
        const memberDetails = getProjectMemberDetails(memberId, projectId);
        const displayName = memberDetails?.member?.display_name || memberId;

        const memberElement = (
          <a
            key={index}
            href={`/${workspaceSlug}/profile/${memberId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center font-medium text-custom-text-100 hover:underline"
          >
            {displayName}
          </a>
        );

        return index < memberIds.length - 1 ? <span key={`wrapper-${index}`}>{memberElement},</span> : memberElement;
      } else {
        // UUID가 아닌 경우 (레거시 데이터) 일반 텍스트로 표시
        const memberElement = (
          <span key={index} className="font-medium text-custom-text-100">
            {memberId}
          </span>
        );

        return index < memberIds.length - 1 ? <span key={`wrapper-${index}`}>{memberElement},</span> : memberElement;
      }
    });
  } else if (fieldType === "date") {
    try {
      return renderFormattedDate(value);
    } catch {
      return value;
    }
  }

  return value;
};

// 커스텀 필드 타입 추출 함수 (실제 커스텀 필드 정보 사용)
const getCustomFieldType = (activity: IIssueActivity, customFields: TCustomField[]): string => {
  const fieldKey = activity.field?.replace("custom_field_", "");

  if (!fieldKey) return "text";

  // 실제 커스텀 필드에서 타입 찾기
  const field = customFields.find((f) => f.name === fieldKey || f.key === fieldKey);

  if (field) {
    return field.field_type;
  }

  // 필드를 찾을 수 없는 경우 값의 형태로 타입 추정 (fallback)
  const value = activity.new_value || activity.old_value;
  if (value) {
    // UUID 패턴 체크 (project_member)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(value)) {
      return "project_member";
    }

    // JSON 배열 패턴 체크 (project_members)
    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0 && uuidPattern.test(parsed[0])) {
          return "project_members";
        }
      } catch {}
    }

    // 쉼표로 구분된 UUID들 (project_members)
    if (value.includes(",")) {
      const parts = value.split(",").map((p) => p.trim());
      if (parts.length > 1 && parts.every((p) => uuidPattern.test(p) || p.length > 0)) {
        return "project_members";
      }
    }

    // 날짜 패턴 체크
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return "date";
    }
  }

  return "text"; // 기본값
};

// 커스텀 필드 activity 메시지 생성
const getCustomFieldActivityMessage = (
  activity: IIssueActivity,
  showIssue: boolean,
  workspaceSlug: string,
  memberHook: any,
  customFields: TCustomField[]
) => {
  const fieldKey = activity.field?.replace("custom_field_", "");

  // 실제 커스텀 필드에서 이름 찾기
  const field = customFields.find((f) => f.name === fieldKey || f.key === fieldKey);
  const fieldName = field?.name || fieldKey || "알 수 없는 필드";
  const fieldType = getCustomFieldType(activity, customFields);

  const projectId = activity.project;

  if (activity.verb === "created") {
    return (
      <>
        커스텀 필드 <span className="font-medium text-custom-text-100">{fieldName}</span> 값을{" "}
        <span className="font-medium text-custom-text-100">
          {formatCustomFieldValue(activity.new_value, fieldType, workspaceSlug, projectId, memberHook, activity)}
        </span>
        {showIssue && (
          <>
            {" "}
            (으)로 <IssueLink activity={activity} />에{" "}
          </>
        )}
        {!showIssue && " (으)로"} 설정했습니다
      </>
    );
  } else if (activity.verb === "updated") {
    return (
      <>
        커스텀 필드 <span className="font-medium text-custom-text-100">{fieldName}</span> 값을{" "}
        <span className="font-medium text-custom-text-100">
          {formatCustomFieldValue(activity.old_value, fieldType, workspaceSlug, projectId, memberHook, activity)}
        </span>
        에서{" "}
        <span className="font-medium text-custom-text-100">
          {formatCustomFieldValue(activity.new_value, fieldType, workspaceSlug, projectId, memberHook, activity)}
        </span>
        {showIssue && (
          <>
            {" "}
            (으)로 <IssueLink activity={activity} />
            에서{" "}
          </>
        )}
        {!showIssue && " (으)로"} 변경했습니다
      </>
    );
  } else if (activity.verb === "deleted") {
    return (
      <>
        커스텀 필드 <span className="font-medium text-custom-text-100">{fieldName}</span>
        {showIssue && (
          <>
            {" "}
            을(를) <IssueLink activity={activity} />
            에서{" "}
          </>
        )}
        {!showIssue && " 을(를)"} 삭제했습니다
      </>
    );
  }

  return (
    <>
      커스텀 필드 <span className="font-medium text-custom-text-100">{fieldName}</span>을(를) 수정했습니다
      {showIssue && (
        <>
          {" "}
          <IssueLink activity={activity} />
          에서
        </>
      )}
    </>
  );
};

const inboxActivityMessage = {
  declined: {
    showIssue: "작업항목을 거부함",
    noIssue: "인테이크에서 이 작업항목을 거부했습니다.",
  },
  snoozed: {
    showIssue: "작업항목을 미룸",
    noIssue: "이 작업항목을 미루었습니다다.",
  },
  accepted: {
    showIssue: "작업항목을 승인함",
    noIssue: "인테이크에서 이 작업항목을 승인했습니다.",
  },
  markedDuplicate: {
    showIssue: "작업항목을 거부함",
    noIssue: "인테이크에서 중복 작업항목으로 표시하여 이 작업항목을 거부했습니다.",
  },
};

const getInboxUserActivityMessage = (activity: IIssueActivity, showIssue: boolean) => {
  switch (activity.verb) {
    case "-1":
      return showIssue ? inboxActivityMessage.declined.showIssue : inboxActivityMessage.declined.noIssue;
    case "0":
      return showIssue ? inboxActivityMessage.snoozed.showIssue : inboxActivityMessage.snoozed.noIssue;
    case "1":
      return showIssue ? inboxActivityMessage.accepted.showIssue : inboxActivityMessage.accepted.noIssue;
    case "2":
      return showIssue ? inboxActivityMessage.markedDuplicate.showIssue : inboxActivityMessage.markedDuplicate.noIssue;
    default:
      return "updated intake work item status.";
  }
};

const activityDetails: {
  [key: string]: {
    message: (activity: IIssueActivity, showIssue: boolean, workspaceSlug: string) => React.ReactNode;
    icon: React.ReactNode;
  };
} = {
  assignees: {
    message: (activity, showIssue) => {
      let isAddOperation = false;
      let isRemoveOperation = false;

      if (activity.verb === "assigned") {
        isAddOperation = true;
      } else if (activity.verb === "unassigned") {
        isRemoveOperation = true;
      } else if (activity.verb === "updated") {
        // 단일 이슈 업데이트 (track_assignees)의 경우 verb가 "updated"로 설정됨
        if (activity.old_value === "" && activity.new_value !== "") {
          isAddOperation = true; // old_value가 비어있고 new_value가 있으면 추가로 간주
        } else if (activity.old_value !== "" && activity.new_value === "") {
          isRemoveOperation = true; // old_value가 있고 new_value가 비어있으면 제거로 간주
        }
      }

      if (isAddOperation) {
        return (
          <>
            새로운 담당자 <UserLink activity={activity} />
            {showIssue && (
              <>
                {" "}
                님을 <IssueLink activity={activity} /> 에 추가했습니다.
              </>
            )}
            {!showIssue && " 님을 추가했습니다."}
          </>
        );
      } else if (isRemoveOperation) {
        return (
          <>
            담당자 <UserLink activity={activity} />
            {showIssue && (
              <>
                {" "}
                님을 <IssueLink activity={activity} /> 에서 제외했습니다.
              </>
            )}
            {!showIssue && " 님을 제외했습니다."}
          </>
        );
      }

      // 위의 조건에 해당하지 않거나, "updated" verb가 명확한 추가/제거 패턴이 아닌 경우
      return (
        <>
          담당자 정보가 <UserLink activity={activity} /> (으)로 변경되었습니다.
          {showIssue && (
            <>
              {" "}
              <IssueLink activity={activity} /> 에서
            </>
          )}
        </>
      );
    },
    icon: <Users2Icon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  archived_at: {
    message: (activity) => {
      if (activity.new_value === "restore")
        return (
          <>
            작업항목 <IssueLink activity={activity} /> 을(를) 복구했습니다.
          </>
        );
      else
        return (
          <>
            작업항목 <IssueLink activity={activity} /> 을(를) 보관했습니다.
          </>
        );
    },
    icon: <ArchiveIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  attachment: {
    message: (activity, showIssue) => {
      if (activity.verb === "created")
        return (
          <>
            새로운 첨부파일{" "}
            <a
              href={`${activity.new_value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              첨부파일
            </a>
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에{" "}
              </>
            )}
            추가했습니다.
          </>
        );
      else
        return (
          <>
            첨부파일을
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에서{" "}
              </>
            )}
            삭제했습니다.
          </>
        );
    },
    icon: <PaperclipIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  description: {
    message: (activity, showIssue) => (
      <>
        {showIssue && (
          <>
            {" "}
            <IssueLink activity={activity} /> 의{" "}
          </>
        )}
        내용을 수정했습니다.
      </>
    ),
    icon: <MessageSquareIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  estimate_point: {
    message: (activity, showIssue) => {
      if (!activity.new_value)
        return (
          <>
            소요자원을
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에서{" "}
              </>
            )}
            삭제했습니다.
          </>
        );
      else
        return (
          <>
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에{" "}
              </>
            )}
            소요자원을 {activity.new_value} 로 설정했습니다
          </>
        );
    },
    icon: <TriangleIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  estimate_time: {
    message: (activity, showIssue) => {
      if (!activity.new_value)
        return (
          <>
            소요시간을
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에서{" "}
              </>
            )}
            삭제했습니다.
          </>
        );
      else {
        // 시간 값을 분에서 시간:분 형식으로 변환
        const timeDisplay = activity.new_value
          ? convertMinutesToHoursMinutesString(Number(activity.new_value))
          : activity.new_value;

        return (
          <>
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에{" "}
              </>
            )}
            소요시간을 {timeDisplay} 으로 설정했습니다.
          </>
        );
      }
    },
    icon: <TriangleIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  estimate_points: {
    message: (activity, showIssue) => {
      if (!activity.new_value)
        return (
          <>
            소요자원을
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에서{" "}
              </>
            )}
            삭제했습니다.
          </>
        );
      else
        return (
          <>
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에{" "}
              </>
            )}
            소요자원을 {activity.new_value} 로 설정했습니다
          </>
        );
    },
    icon: <TriangleIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  estimate_categories: {
    message: (activity, showIssue) => {
      if (!activity.new_value)
        return (
          <>
            소요자원을
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에서{" "}
              </>
            )}
            삭제했습니다.
          </>
        );
      else
        return (
          <>
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에{" "}
              </>
            )}
            소요자원을 {activity.new_value} 로 설정했습니다
          </>
        );
    },
    icon: <TriangleIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  issue: {
    message: (activity) => {
      if (activity.verb === "created")
        return (
          <>
            <IssueLink activity={activity} /> 을 생성했습니다.
          </>
        );
      else if (activity.verb === "converted")
        return (
          <>
            <IssueLink activity={activity} /> 을 에픽으로 변환했습니다.
          </>
        );
      else
        return (
          <>
            <IssueLink activity={activity} /> 을 삭제했습니다.
          </>
        );
    },
    icon: <WorkItemsIcon width={12} height={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  epic: {
    message: (activity) => {
      if (activity.verb === "created")
        return (
          <>
            <IssueLink activity={activity} /> 을 생성했습니다.
          </>
        );
      else if (activity.verb === "converted")
        return (
          <>
            <IssueLink activity={activity} /> 을 작업 항목으로 변환했습니다.
          </>
        );
      else
        return (
          <>
            <IssueLink activity={activity} /> 을 삭제했습니다.
          </>
        );
    },
    icon: <EpicIcon width={12} height={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  labels: {
    message: (activity, showIssue, workspaceSlug) => {
      if (activity.old_value === "")
        return (
          <span className="overflow-hidden">
            새로운 레이블{" "}
            <span className="inline-flex items-center gap-2 rounded-full border border-custom-border-300 px-2 py-0.5 text-xs">
              <LabelPill labelId={activity.new_identifier ?? ""} workspaceSlug={workspaceSlug} />
              <span className="flex-shrink font-medium text-custom-text-100 break-all line-clamp-1">
                {activity.new_value}
              </span>
            </span>
            을
            {showIssue && (
              <span className="">
                {" "}
                <IssueLink activity={activity} /> 에{" "}
              </span>
            )}
            추가했습니다.
          </span>
        );
      else
        return (
          <>
            레이블 을
            <span className="inline-flex items-center gap-2 rounded-full border border-custom-border-300 px-2 py-0.5 text-xs">
              <LabelPill labelId={activity.old_identifier ?? ""} workspaceSlug={workspaceSlug} />
              <span className="flex-shrink font-medium text-custom-text-100 break-all line-clamp-1">
                {activity.old_value}
              </span>
            </span>
            {showIssue && (
              <span>
                {" "}
                <IssueLink activity={activity} /> 에서{" "}
              </span>
            )}
            삭제했습니다.
          </>
        );
    },
    icon: <TagIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  link: {
    message: (activity, showIssue) => {
      if (activity.verb === "created")
        return (
          <>
            새로운 링크{" "}
            <a
              href={`${activity.new_value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              링크
            </a>
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에{" "}
              </>
            )}
            추가했습니다.
          </>
        );
      else if (activity.verb === "updated")
        return (
          <>
            링크{" "}
            <a
              href={`${activity.old_value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              링크
            </a>
            를
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에서{" "}
              </>
            )}
            수정 했습니다.
          </>
        );
      else
        return (
          <>
            링크{" "}
            <a
              href={`${activity.old_value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              링크
            </a>
            를
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에서{" "}
              </>
            )}
            삭제했습니다.
          </>
        );
    },
    icon: <Link2Icon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  cycles: {
    message: (activity, showIssue, workspaceSlug) => {
      if (activity.verb === "created")
        return (
          <>
            <span className="flex-shrink-0">
              {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}{" "}
              <span className="whitespace-nowrap">을(를) 사이클에</span>{" "}
            </span>
            <a
              href={`/${workspaceSlug}/projects/${activity.project}/cycles/${activity.new_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              <span className="break-all">{activity.new_value}</span>
            </a>
            <span> 추가했습니다</span>
          </>
        );
      else if (activity.verb === "updated")
        return (
          <>
            <span className="flex-shrink-0 whitespace-nowrap">사이클을 </span>
            <a
              href={`/${workspaceSlug}/projects/${activity.project}/cycles/${activity.new_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              <span className="break-all">{activity.new_value}</span>
            </a>
            <span>으로 설정했습니다</span>
          </>
        );
      else
        return (
          <>
            <IssueLink activity={activity} /> 을(를) 사이클{" "}
            <a
              href={`/${workspaceSlug}/projects/${activity.project}/cycles/${activity.old_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              <span className="break-all">{activity.old_value}</span>
            </a>
            <span>에서 제거했습니다</span>
          </>
        );
    },
    icon: <CycleIcon height={12} width={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  modules: {
    message: (activity, showIssue, workspaceSlug) => {
      if (activity.verb === "created")
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}을 모듈{" "}
            <a
              href={`/${workspaceSlug}/projects/${activity.project}/modules/${activity.new_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              <span className="break-all">{activity.new_value}</span>
            </a>
            <span>에 추가했습니다</span>
          </>
        );
      else if (activity.verb === "updated")
        return (
          <>
            모듈을{" "}
            <a
              href={`/${workspaceSlug}/projects/${activity.project}/modules/${activity.new_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              <span className="break-all">{activity.new_value}</span>
            </a>
            <span>으로 설정했습니다</span>
          </>
        );
      else
        return (
          <>
            <IssueLink activity={activity} /> 을(를) 모듈{" "}
            <a
              href={`/${workspaceSlug}/projects/${activity.project}/modules/${activity.old_identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              <span className="break-all">{activity.old_value}</span>
            </a>
            <span>에서 제거했습니다</span>
          </>
        );
    },
    icon: <ModuleIcon className="h-3 w-3 !text-custom-text-200" aria-hidden="true" />,
  },
  name: {
    message: (activity, showIssue) => (
      <>
        제목을 <span className="break-all">{activity.new_value}</span>
        {showIssue && (
          <>
            {" "}
            (으)로 <IssueLink activity={activity} />
          </>
        )}
        {!showIssue && " (으)로"} 변경했습니다
      </>
    ),
    icon: <MessageSquareIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  parent: {
    message: (activity, showIssue) => {
      if (!activity.new_value)
        return (
          <>
            상위 항목 <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>
            {showIssue && (
              <>
                {" "}
                을(를) <IssueLink activity={activity} />
                에서{" "}
              </>
            )}
            제거했습니다
          </>
        );
      else
        return (
          <>
            상위 항목을 <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span>
            {showIssue && (
              <>
                {" "}
                (으)로 <IssueLink activity={activity} />에{" "}
              </>
            )}
            설정했습니다
          </>
        );
    },
    icon: <UsersIcon className="h-3 w-3 !text-custom-text-200" aria-hidden="true" />,
  },
  priority: {
    message: (activity, showIssue) => (
      <>
        우선순위를{" "}
        <span className="font-medium text-custom-text-100">
          {activity.new_value ? capitalizeFirstLetter(activity.new_value) : "없음"}
        </span>
        {showIssue && (
          <>
            {" "}
            (으)로 <IssueLink activity={activity} />에{" "}
          </>
        )}
        {!showIssue && " (으)로"} 설정했습니다
      </>
    ),
    icon: <SignalMediumIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  relates_to: {
    message: (activity, showIssue) => {
      if (activity.old_value === "")
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가){" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span>와(과)
            관련됨을 표시했습니다.
          </>
        );
      else
        return (
          <>
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>와(과)의
            관계를 제거했습니다.
          </>
        );
    },
    icon: <RelatedIcon height="12" width="12" className="text-custom-text-200" />,
  },
  blocking: {
    message: (activity, showIssue) => {
      if (activity.old_value === "")
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가){" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span> 작업항목을
            차단하고 있음을 표시했습니다.
          </>
        );
      else
        return (
          <>
            차단 작업항목{" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>을(를)
            제거했습니다.
          </>
        );
    },
    icon: <BlockerIcon height="12" width="12" className="text-custom-text-200" />,
  },
  blocked_by: {
    message: (activity, showIssue) => {
      if (activity.old_value === "")
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가){" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span>에 의해
            차단되고 있음을 표시했습니다.
          </>
        );
      else
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가) 작업항목{" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>에 의해
            차단되는 것을 제거했습니다.
          </>
        );
    },
    icon: <BlockedIcon height="12" width="12" className="text-custom-text-200" />,
  },
  duplicate: {
    message: (activity, showIssue) => {
      if (activity.old_value === "")
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가){" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span>의 중복임을
            표시했습니다.
          </>
        );
      else
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가){" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>의
            중복이라는 표시를 제거했습니다.
          </>
        );
    },
    icon: <CopyPlus size={12} className="text-custom-text-200" />,
  },
  state: {
    message: (activity, showIssue) => {
      // 워크플로우 승인 정보 파싱
      const comment = activity.comment || "";
      const approvalMatch = comment.match(/\(approved by ([^)]+)\)(?:\s*-\s*(.+))?/);

      return (
        <>
          상태를 <span className="font-medium text-custom-text-100 break-all">{activity.new_value}</span>
          {showIssue && (
            <>
              {" "}
              (으)로 <IssueLink activity={activity} />에{" "}
            </>
          )}
          {!showIssue && " (으)로"} 설정했습니다.
          {approvalMatch && (
            <span className="text-custom-text-200">
              {" "}
              (승인자: <span className="font-medium text-custom-text-100">{approvalMatch[1]}</span>
              {approvalMatch[2] && (
                <>
                  , 승인 코멘트: <span className="font-medium text-custom-text-100">{approvalMatch[2]}</span>
                </>
              )}
              )
            </span>
          )}
        </>
      );
    },
    icon: <LayoutGridIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  workflow_approval: {
    message: (activity, showIssue) => {
      const comment = activity.comment || "";
      const reason = comment.includes(":") ? comment.split(":").slice(1).join(":").trim() : "";
      const isSelfApproval = comment.toLowerCase().startsWith("self-approved");
      const oldState = activity.old_value;
      const newState = activity.new_value;

      return (
        <>
          {isSelfApproval ? "본인 승인으로 " : ""}
          {showIssue ? (
            <>
              <IssueLink activity={activity} /> 의 상태를{" "}
            </>
          ) : (
            "이 작업항목의 상태를 "
          )}
          {oldState && (
            <>
              <span className="font-medium text-custom-text-100 break-all">{oldState}</span>
              {"에서 "}
            </>
          )}
          <span className="font-medium text-custom-text-100 break-all">{newState}</span>
          {" (으)로 변경하는 것을 승인했습니다."}
          {reason && (
            <span className="text-custom-text-200">
              {" "}
              (승인 사유: <span className="font-medium text-custom-text-100 break-all">{reason}</span>)
            </span>
          )}
        </>
      );
    },
    icon: <LayoutGridIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  start_date: {
    message: (activity, showIssue) => {
      if (!activity.new_value)
        return (
          <>
            시작일을
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} />
                에서{" "}
              </>
            )}
            삭제했습니다
          </>
        );
      else
        return (
          <>
            시작일을{" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">
              {renderFormattedDate(activity.new_value)}
            </span>
            {showIssue && (
              <>
                {" "}
                (으)로 <IssueLink activity={activity} />에{" "}
              </>
            )}
            {!showIssue && " (으)로"} 설정했습니다
          </>
        );
    },
    icon: <Calendar size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  target_date: {
    message: (activity, showIssue) => {
      if (!activity.new_value)
        return (
          <>
            마감일을
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} />
                에서{" "}
              </>
            )}
            삭제했습니다
          </>
        );
      else
        return (
          <>
            마감일을{" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">
              {renderFormattedDate(activity.new_value)}
            </span>
            {showIssue && (
              <>
                {" "}
                (으)로 <IssueLink activity={activity} />에{" "}
              </>
            )}
            {!showIssue && " (으)로"} 설정했습니다
          </>
        );
    },
    icon: <Calendar size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  inbox: {
    message: (activity, showIssue) => (
      <>
        {getInboxUserActivityMessage(activity, showIssue)}
        {showIssue && (
          <>
            {" "}
            <IssueLink activity={activity} />
          </>
        )}
        {activity.verb === "2" && ` 인테이크에서 중복 작업항목으로 표시하여 거부함.`}
      </>
    ),
    icon: <IntakeIcon className="size-3 text-custom-text-200" aria-hidden="true" />,
  },
};

export const ActivityIcon = ({
  activity,
  customFields = [],
}: {
  activity: IIssueActivity;
  customFields?: TCustomField[];
}) => {
  // 커스텀 필드 activity인 경우
  if (activity.field?.startsWith("custom_field_")) {
    const fieldType = getCustomFieldType(activity, customFields);
    return getCustomFieldIcon(fieldType);
  }

  return <>{activityDetails[activity.field as keyof typeof activityDetails]?.icon}</>;
};

type ActivityMessageProps = {
  activity: IIssueActivity;
  showIssue?: boolean;
  customFields?: TCustomField[];
};

export const ActivityMessage = ({ activity, showIssue = false, customFields = [] }: ActivityMessageProps) => {
  // router params
  const { workspaceSlug } = useParams();
  // member hook
  const memberHook = useMember();

  // 커스텀 필드 activity 처리
  if (activity.field?.startsWith("custom_field_")) {
    return (
      <>
        {getCustomFieldActivityMessage(
          activity,
          showIssue,
          workspaceSlug ? workspaceSlug.toString() : (activity.workspace_detail?.slug ?? ""),
          memberHook,
          customFields
        )}
      </>
    );
  }

  return (
    <>
      {activityDetails[activity.field as keyof typeof activityDetails]?.message(
        activity,
        showIssue,
        workspaceSlug ? workspaceSlug.toString() : (activity.workspace_detail?.slug ?? "")
      )}
    </>
  );
};
