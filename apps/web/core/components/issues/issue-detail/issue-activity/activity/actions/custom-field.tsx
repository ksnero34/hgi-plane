import { FC } from "react";
import { observer } from "mobx-react";
import { Tag, CalendarDays, Users, User, MessageSquareIcon } from "lucide-react";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useParams } from "next/navigation";
// components
import { IssueActivityBlockComponent } from "./helpers/activity-block";
import { IssueLink } from "./helpers/issue-link";
// types
import type { TCustomField } from "@plane/types";

type TIssueCustomFieldActivity = {
  activityId: string;
  showIssue?: boolean;
  ends: "top" | "bottom" | undefined;
  customFields?: TCustomField[];
};

export const IssueCustomFieldActivity: FC<TIssueCustomFieldActivity> = observer((props) => {
  const { activityId, ends, showIssue, customFields = [] } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();
  const {
    project: { getProjectMemberDetails, getProjectMemberIds },
  } = useMember();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;

  const getFieldName = () => {
    const fieldKey = activity.field?.replace("custom_field_", "");
    const field = customFields.find((f) => f.name === fieldKey || f.key === fieldKey);
    return field?.name || fieldKey || "알 수 없는 필드";
  };

  const getFieldType = () => {
    const fieldKey = activity.field?.replace("custom_field_", "");
    const field = customFields.find((f) => f.name === fieldKey || f.key === fieldKey);
    return field?.field_type || "text";
  };

  const getIcon = () => {
    const fieldType = getFieldType();

    switch (fieldType) {
      case "text":
        return <MessageSquareIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />;
      case "date":
        return <CalendarDays className="h-4 w-4 flex-shrink-0 text-custom-text-200" />;
      case "project_member":
        return <User className="h-4 w-4 flex-shrink-0 text-custom-text-200" />;
      case "project_members":
        return <Users className="h-4 w-4 flex-shrink-0 text-custom-text-200" />;
      case "select":
      case "multiselect":
      default:
        return <Tag className="h-4 w-4 flex-shrink-0 text-custom-text-200" />;
    }
  };

  const formatValue = (value: string | null): React.ReactNode => {
    if (!value) return "없음";

    // 해당 커스텀 필드 정보 찾기
    const fieldType = getFieldType();

    // project_member 타입인 경우 멤버 이름으로 변환
    if (fieldType === "project_member") {
      try {
        // 백엔드에서 이미 포맷팅된 멤버 이름인지 확인
        // UUID 형태가 아니라면 이미 포맷팅된 이름일 가능성이 높음
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

        if (isUUID) {
          // UUID인 경우 기존 로직 사용
          const memberDetails = getProjectMemberDetails(value, projectId as string);
          if (memberDetails?.member) {
            return (
              <a
                href={`/${workspaceSlug}/profile/${value}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-medium text-custom-text-100 hover:underline"
              >
                {memberDetails.member.display_name}
              </a>
            );
          }
          // UUID이지만 멤버 정보를 찾을 수 없는 경우에도 링크 생성
          return (
            <a
              href={`/${workspaceSlug}/profile/${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center font-medium text-custom-text-100 hover:underline"
            >
              {value}
            </a>
          );
        } else {
          // 이미 포맷팅된 멤버 이름인 경우, 모든 프로젝트 멤버에서 이름으로 찾기
          const allMemberIds = getProjectMemberIds(projectId as string, true) || [];
          const memberId = allMemberIds.find((id) => {
            const memberDetails = getProjectMemberDetails(id, projectId as string);
            return memberDetails?.member?.display_name === value.trim();
          });

          if (memberId) {
            return (
              <a
                href={`/${workspaceSlug}/profile/${memberId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-medium text-custom-text-100 hover:underline"
              >
                {value}
              </a>
            );
          }
          // 멤버를 찾을 수 없는 경우 일반 텍스트로 반환
          return value;
        }
      } catch (e) {
        // 멤버 정보를 찾을 수 없는 경우 원본 값 반환
        return value;
      }
    }

    // project_members 타입인 경우 멤버 이름들로 변환
    if (fieldType === "project_members") {
      try {
        // 백엔드에서 이미 포맷팅된 값인지 확인 (쉼표로 구분된 이름들)
        if (typeof value === "string" && !value.startsWith("[") && value.includes(",")) {
          // 이미 포맷팅된 멤버 이름들인 경우
          // 모든 프로젝트 멤버를 가져와서 이름으로 매칭하여 하이퍼링크 생성
          const memberNames = value.split(", ");
          const allMemberIds = getProjectMemberIds(projectId as string, true) || [];

          const memberElements = memberNames.map((name, index) => {
            // 이름으로 멤버 찾기
            const memberId = allMemberIds.find((id) => {
              const memberDetails = getProjectMemberDetails(id, projectId as string);
              return memberDetails?.member?.display_name === name.trim();
            });

            if (memberId) {
              return (
                <span key={`${name}-${index}`}>
                  <a
                    href={`/${workspaceSlug}/profile/${memberId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-medium text-custom-text-100 hover:underline"
                  >
                    {name.trim()}
                  </a>
                  {index < memberNames.length - 1 && ", "}
                </span>
              );
            } else {
              // 멤버를 찾을 수 없는 경우 일반 텍스트로 표시
              return (
                <span key={`${name}-${index}`}>
                  {name.trim()}
                  {index < memberNames.length - 1 && ", "}
                </span>
              );
            }
          });

          return <>{memberElements}</>;
        }

        // JSON 배열인지 확인
        let memberIds: string[];
        if (typeof value === "string") {
          // JSON 문자열인 경우 파싱 시도
          if (value.startsWith("[") && value.endsWith("]")) {
            memberIds = JSON.parse(value);
          } else {
            // 단일 값인 경우 배열로 변환
            memberIds = [value];
          }
        } else {
          memberIds = Array.isArray(value) ? value : [value];
        }

        if (Array.isArray(memberIds)) {
          const memberElements = memberIds
            .map((id, index) => {
              const memberDetails = getProjectMemberDetails(id, projectId as string);
              if (memberDetails?.member) {
                return (
                  <span key={id}>
                    <a
                      href={`/${workspaceSlug}/profile/${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center font-medium text-custom-text-100 hover:underline"
                    >
                      {memberDetails.member.display_name}
                    </a>
                    {index < memberIds.length - 1 && ", "}
                  </span>
                );
              }
              return null;
            })
            .filter((element) => element !== null);

          return memberElements.length > 0 ? <>{memberElements}</> : value;
        }
      } catch (e) {
        // JSON 파싱 실패 시 원본 값 반환
      }
      return value;
    }

    // 기타 타입의 경우 JSON 배열 처리
    try {
      // JSON 배열인 경우 쉼표로 구분된 문자열로 변환
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.join(", ");
        }
      }
    } catch (e) {
      // JSON 파싱 실패 시 원본 값 반환
    }

    return value;
  };

  const getActivityMessage = () => {
    const fieldName = getFieldName();
    const formattedNewValue = formatValue(activity.new_value ?? null);
    const formattedOldValue = formatValue(activity.old_value ?? null);

    switch (activity.verb) {
      case "created":
        return (
          <>
            님이 <span className="font-medium text-custom-text-100">{fieldName}</span> 필드를{" "}
            <span className="font-medium text-custom-text-100">{formattedNewValue}</span>로 설정했습니다
          </>
        );
      case "updated":
        return (
          <>
            님이 <span className="font-medium text-custom-text-100">{fieldName}</span> 필드를{" "}
            {activity.old_value && (
              <>
                <span className="font-medium text-custom-text-100">{formattedOldValue}</span>에서{" "}
              </>
            )}
            <span className="font-medium text-custom-text-100">{formattedNewValue}</span>로 변경했습니다
          </>
        );
      case "deleted":
        return (
          <>
            님이 <span className="font-medium text-custom-text-100">{fieldName}</span> 필드{" "}
            <span className="font-medium text-custom-text-100">{formattedOldValue}</span>를 제거했습니다
          </>
        );
      default:
        return (
          <>
            님이 <span className="font-medium text-custom-text-100">{fieldName}</span> 필드를 수정했습니다
          </>
        );
    }
  };

  return (
    <IssueActivityBlockComponent icon={getIcon()} activityId={activityId} ends={ends}>
      <>
        {getActivityMessage()}
        {showIssue ? ` for ` : ``}
        {showIssue && <IssueLink activityId={activityId} />}.
      </>
    </IssueActivityBlockComponent>
  );
});
