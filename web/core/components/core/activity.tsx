"use client";

import { useEffect } from "react";
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
} from "lucide-react";
import { IIssueActivity } from "@plane/types";
import { Tooltip, BlockedIcon, BlockerIcon, RelatedIcon, LayersIcon, DiceIcon, Intake } from "@plane/ui";
// helpers
import { renderFormattedDate } from "@/helpers/date-time.helper";
import { generateWorkItemLink } from "@/helpers/issue.helper";
import { capitalizeFirstLetter } from "@/helpers/string.helper";
import { convertMinutesToHoursMinutesString } from "@/helpers/date-time.helper";
import { useLabel } from "@/hooks/store";
import { usePlatformOS } from "@/hooks/use-platform-os";
// types

export const IssueLink = ({ activity }: { activity: IIssueActivity }) => {
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
};

const UserLink = ({ activity }: { activity: IIssueActivity }) => {
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
};

const LabelPill = observer(({ labelId, workspaceSlug }: { labelId: string; workspaceSlug: string }) => {
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
      if (activity.old_value === "")
        return (
          <>
            새로운 담당자 <UserLink activity={activity} />
            {showIssue && (
              <>
                {" "}
                님 을 <IssueLink activity={activity} /> 에 추가했습니다.
              </>
            )}
          </>
        );
      else
        return (
          <>
            담당자 <UserLink activity={activity} />
            {showIssue && (
              <>
                {" "}
                님을 <IssueLink activity={activity} /> 에서 제외했습니다.
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
            새로운 첨부파일
            {/* <a
              href={`${activity.new_value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-custom-text-100 hover:underline"
            >
              파일
            </a> */}
            을
            {showIssue && (
              <>
                {" "}
                <IssueLink activity={activity} /> 에{" "}
              </>
            )}
            업로드 했습니다.
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
        const timeDisplay = activity.new_value ? 
          convertMinutesToHoursMinutesString(Number(activity.new_value)) : 
          activity.new_value;
          
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
      else
        return (
          <>
            <IssueLink activity={activity} /> 을 삭제했습니다.
          </>
        );
    },
    icon: <LayersIcon width={12} height={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  labels: {
    message: (activity, showIssue, workspaceSlug) => {
      if (activity.old_value === "")
        return (
          <span className="overflow-hidden">
            새로운 레이블 {" "}
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
            레이블 {" "} 을
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
            새로운 링크 {" "}
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
            링크 {" "}
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
            링크 {" "}
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
            <IssueLink activity={activity} /> 을(를) 사이클 {" "}
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
    icon: <ContrastIcon size={12} className="text-custom-text-200" aria-hidden="true" />,
  },
  modules: {
    message: (activity, showIssue, workspaceSlug) => {
      if (activity.verb === "created")
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}을(를) 모듈 {" "}
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
            모듈을 {" "}
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
            <IssueLink activity={activity} /> 을(를) 모듈 {" "}
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
    icon: <DiceIcon className="h-3 w-3 !text-custom-text-200" aria-hidden="true" />,
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
            상위 항목 {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>
            {showIssue && (
              <>
                {" "}
                을(를) <IssueLink activity={activity} />에서{" "}
              </>
            )}
            제거했습니다
          </>
        );
      else
        return (
          <>
            상위 항목을 {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span>
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
        우선순위를 {" "}
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
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가) {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span>와(과) 관련됨을 표시했습니다.
          </>
        );
      else
        return (
          <>
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>와(과)의 관계를 제거했습니다.
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
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가) {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span> 작업항목을 차단하고 있음을 표시했습니다.
          </>
        );
      else
        return (
          <>
            차단 작업항목 {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>을(를) 제거했습니다.
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
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가) {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span>에 의해 차단되고 있음을 표시했습니다.
          </>
        );
      else
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가) 작업항목 {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>에 의해 차단되는 것을 제거했습니다.
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
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가) {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.new_value}</span>의 중복임을 표시했습니다.
          </>
        );
      else
        return (
          <>
            {showIssue ? <IssueLink activity={activity} /> : "이 작업항목"}이(가) {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">{activity.old_value}</span>의 중복이라는 표시를 제거했습니다.
          </>
        );
    },
    icon: <CopyPlus size={12} className="text-custom-text-200" />,
  },
  state: {
    message: (activity, showIssue) => (
      <>
        상태를 <span className="font-medium text-custom-text-100 break-all">{activity.new_value}</span>
        {showIssue && (
          <>
            {" "}
            (으)로 <IssueLink activity={activity} />에{" "}
          </>
        )}
        {!showIssue && " (으)로"} 설정했습니다
      </>
    ),
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
                <IssueLink activity={activity} />에서{" "}
              </>
            )}
            삭제했습니다
          </>
        );
      else
        return (
          <>
            시작일을 {" "}
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
                <IssueLink activity={activity} />에서{" "}
              </>
            )}
            삭제했습니다
          </>
        );
      else
        return (
          <>
            마감일을 {" "}
            <span className="font-medium text-custom-text-100 whitespace-nowrap">
              {renderFormattedDate(activity.new_value)}
            </span>
            {showIssue && (
              <>
                {" "}(으)로 <IssueLink activity={activity} />에{" "}
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
    icon: <Intake className="size-3 text-custom-text-200" aria-hidden="true" />,
  },
};

export const ActivityIcon = ({ activity }: { activity: IIssueActivity }) => (
  <>{activityDetails[activity.field as keyof typeof activityDetails]?.icon}</>
);

type ActivityMessageProps = {
  activity: IIssueActivity;
  showIssue?: boolean;
};

export const ActivityMessage = ({ activity, showIssue = false }: ActivityMessageProps) => {
  // router params
  const { workspaceSlug } = useParams();

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
