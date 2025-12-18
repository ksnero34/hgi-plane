import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// ui
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { Loader, Card } from "@plane/ui";
import type { TCustomField } from "@plane/types";
import { calculateTimeAgo, getFileURL } from "@plane/utils";
// components
import { ActivityMessage, IssueLink } from "@/components/core/activity";
// constants
import { USER_PROFILE_ACTIVITY } from "@/constants/fetch-keys";
// helpers
// hooks
import { useUser } from "@/hooks/store/user";
// services
import { UserService } from "@/services/user.service";

const userService = new UserService();

export const ProfileActivity = observer(function ProfileActivity() {
  const { workspaceSlug, userId } = useParams();
  // store hooks
  const { data: currentUser } = useUser();
  const { t } = useTranslation();

  const { data: userProfileActivity } = useSWR(
    workspaceSlug && userId ? USER_PROFILE_ACTIVITY(workspaceSlug.toString(), userId.toString(), {}) : null,
    workspaceSlug && userId
      ? () =>
          userService.getUserProfileActivity(workspaceSlug.toString(), userId.toString(), {
            per_page: 10,
          })
      : null
  );

  // 프로젝트별 커스텀 필드와 멤버 정보 동시 조회 with useSWR
  const { data: projectDetails } = useSWR(
    userProfileActivity?.results?.length ? ["project-details", userProfileActivity] : null,
    async () => {
      if (!userProfileActivity) return {};

      const projectData = userProfileActivity.results.reduce((acc: any, activity: any) => {
        if (activity.project && activity.workspace_detail?.slug) {
          acc[activity.project] = activity.workspace_detail.slug;
        }
        return acc;
      }, {});

      const customFieldsMap: { [projectId: string]: TCustomField[] } = {};
      let workspaceMembers: any[] = [];

      const workspaceSlugValue = Object.values(projectData)[0] as string;
      if (workspaceSlugValue) {
        try {
          const membersResponse = await fetch(`/api/workspaces/${workspaceSlugValue}/members/`, {
            credentials: "include",
          });
          if (membersResponse.ok) {
            workspaceMembers = await membersResponse.json();
          }
        } catch (error) {
          console.error(`워크스페이스 멤버 로드 중 오류:`, error);
        }
      }

      await Promise.all(
        Object.entries(projectData).map(async ([projectId, wsSlug]) => {
          try {
            const customFieldsResponse = await fetch(`/api/workspaces/${wsSlug}/projects/${projectId}/custom-fields/`, {
              credentials: "include",
            });
            if (customFieldsResponse.ok) {
              customFieldsMap[projectId] = await customFieldsResponse.json();
            } else {
              customFieldsMap[projectId] = [];
            }
          } catch (error) {
            console.error(`프로젝트 데이터 로드 중 오류 (프로젝트 ${projectId}):`, error);
            customFieldsMap[projectId] = [];
          }
        })
      );

      const membersMap: { [projectId: string]: any[] } = {};
      Object.keys(projectData).forEach((projectId) => {
        membersMap[projectId] = workspaceMembers;
      });

      return { customFieldsByProject: customFieldsMap, membersByProject: membersMap };
    }
  );

  // 프로젝트별 멤버 정보를 제공하는 mock hook 생성
  const createMemberHook = (projectId: string) => {
    const projectMembers = projectDetails?.membersByProject?.[projectId] || [];

    return {
      project: {
        getProjectMemberDetails: (memberId: string) => {
          // 워크스페이스 멤버에서 해당 멤버 찾기
          const member = projectMembers.find((m) => m.member?.id === memberId || m.id === memberId);
          return member || null;
        },
        getProjectMemberIds: () => {
          return projectMembers.map((m) => m.member?.id || m.id).filter(Boolean);
        },
      },
    };
  };

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium">{t("profile.stats.recent_activity.title")}</h3>
      <Card>
        {userProfileActivity ? (
          userProfileActivity.results.length > 0 ? (
            <div className="space-y-5">
              {userProfileActivity.results.map((activity) => {
                const projectCustomFields = projectDetails?.customFieldsByProject?.[activity.project] || [];
                const memberHook = createMemberHook(activity.project);

                return (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex-shrink-0 grid place-items-center overflow-hidden rounded h-6 w-6">
                      {activity.actor_detail?.avatar_url && activity.actor_detail?.avatar_url !== "" ? (
                        <img
                          src={getFileURL(activity.actor_detail?.avatar_url)}
                          alt={activity.actor_detail?.display_name}
                          className="rounded"
                        />
                      ) : (
                        <div className="grid h-6 w-6 place-items-center rounded border-2 bg-gray-700 text-xs text-white">
                          {activity.actor_detail?.display_name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="-mt-1 w-4/5 break-words">
                      <p className="inline text-sm text-custom-text-200">
                        <span className="font-medium text-custom-text-100">
                          {currentUser?.id === activity.actor_detail?.id
                            ? "당신이"
                            : activity.actor_detail?.display_name + " 님이"}{" "}
                        </span>
                        {activity.field ? (
                          <ProfileActivityMessage
                            activity={activity}
                            showIssue
                            customFields={projectCustomFields}
                            memberHook={memberHook}
                          />
                        ) : (
                          <span>
                            <IssueLink activity={activity} /> 을 생성했습니다.
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-custom-text-200 whitespace-nowrap ">
                        {calculateTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyStateCompact title={t("no_data_yet")} assetKey="unknown" assetClassName="size-20" />
          )
        ) : (
          <Loader className="space-y-5">
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
          </Loader>
        )}
      </Card>
    </div>
  );
});

// 프로필 전용 ActivityMessage 컴포넌트
const ProfileActivityMessage = ({
  activity,
  showIssue = false,
  customFields = [],
  memberHook,
}: {
  activity: any;
  showIssue?: boolean;
  customFields?: TCustomField[];
  memberHook: any;
}) => {
  const { workspaceSlug } = useParams();

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

  // 기본 ActivityMessage 사용
  return <ActivityMessage activity={activity} showIssue={showIssue} customFields={customFields} />;
};

// 커스텀 필드 activity 메시지 생성 (core/activity.tsx에서 복사)
const getCustomFieldActivityMessage = (
  activity: any,
  showIssue: boolean,
  workspaceSlug: string,
  memberHook: any,
  customFields: TCustomField[]
) => {
  const fieldKey = activity.field?.replace("custom_field_", "");

  // 실제 커스텀 필드에서 이름 찾기
  const field = customFields.find((f: TCustomField) => f.name === fieldKey || f.key === fieldKey);
  const fieldName = field?.name || fieldKey || "알 수 없는 필드";
  const fieldType = field?.field_type || "text";

  const projectId = activity.project;

  if (activity.verb === "created") {
    return (
      <>
        커스텀 필드 <span className="font-medium text-custom-text-100">{fieldName}</span> 값을{" "}
        <span className="font-medium text-custom-text-100">
          {formatCustomFieldValueForProfile(activity.new_value, fieldType, workspaceSlug, projectId, memberHook)}
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
          {formatCustomFieldValueForProfile(activity.old_value, fieldType, workspaceSlug, projectId, memberHook)}
        </span>
        에서{" "}
        <span className="font-medium text-custom-text-100">
          {formatCustomFieldValueForProfile(activity.new_value, fieldType, workspaceSlug, projectId, memberHook)}
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

// 프로필용 커스텀 필드 값 포맷팅 함수
const formatCustomFieldValueForProfile = (
  value: string | null,
  fieldType: string,
  workspaceSlug: string,
  projectId: string,
  memberHook: any
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
      const memberDetails = getProjectMemberDetails(value);
      const displayName = memberDetails?.member?.display_name || memberDetails?.display_name || value;

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
      } else if (value.includes(",")) {
        // 쉼표로 구분된 문자열인 경우
        memberIds = value.split(",").map((id) => id.trim());
      } else {
        // 단일 값인 경우
        memberIds = [value.trim()];
      }
    } catch {
      // JSON 파싱 실패 시 쉼표로 구분된 문자열로 처리
      memberIds = value.split(",").map((id) => id.trim());
    }

    return memberIds.map((memberId, index) => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

      if (isUUID) {
        // UUID인 경우 멤버 정보 조회
        const memberDetails = getProjectMemberDetails(memberId);
        const displayName = memberDetails?.member?.display_name || memberDetails?.display_name || memberId;

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
      // 날짜 포맷팅 (간단한 버전)
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }

  return value;
};
