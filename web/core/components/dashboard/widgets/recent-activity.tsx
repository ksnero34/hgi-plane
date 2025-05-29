"use client";

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { History } from "lucide-react";
// types
import { TRecentActivityWidgetResponse, TCustomField } from "@plane/types";
// components
import { Card, Avatar, getButtonStyling } from "@plane/ui";
import { ActivityIcon, ActivityMessage, IssueLink } from "@/components/core";
import { RecentActivityEmptyState, WidgetLoader, WidgetProps } from "@/components/dashboard/widgets";
// helpers
import { cn } from "@/helpers/common.helper";
import { calculateTimeAgo } from "@/helpers/date-time.helper";
import { getFileURL } from "@/helpers/file.helper";
// hooks
import { useDashboard, useUser } from "@/hooks/store";

const WIDGET_KEY = "recent_activity";

export const RecentActivityWidget: React.FC<WidgetProps> = observer((props) => {
  const { dashboardId, workspaceSlug } = props;
  // store hooks
  const { data: currentUser } = useUser();
  // derived values
  const { fetchWidgetStats, getWidgetStats } = useDashboard();
  const widgetStats = getWidgetStats<TRecentActivityWidgetResponse[]>(workspaceSlug, dashboardId, WIDGET_KEY);
  const redirectionLink = `/${workspaceSlug}/profile/${currentUser?.id}/activity`;

  // 커스텀 필드 상태
  const [customFieldsByProject, setCustomFieldsByProject] = useState<{ [projectId: string]: TCustomField[] }>({});

  useEffect(() => {
    fetchWidgetStats(workspaceSlug, dashboardId, {
      widget_key: WIDGET_KEY,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 프로젝트별 커스텀 필드 조회
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!widgetStats) return;
      
      // 활동에서 고유한 프로젝트 ID들 추출
      const projectIds = [...new Set(widgetStats.map(activity => activity.project))];
      
      const customFieldsMap: { [projectId: string]: TCustomField[] } = {};
      
      await Promise.all(
        projectIds.map(async (projectId) => {
          try {
            const response = await fetch(
              `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`,
              {
                credentials: "include",
              }
            );
            if (response.ok) {
              const data = await response.json();
              customFieldsMap[projectId] = data;
            }
          } catch (error) {
            console.error(`커스텀 필드 로드 중 오류 (프로젝트 ${projectId}):`, error);
            customFieldsMap[projectId] = [];
          }
        })
      );
      
      setCustomFieldsByProject(customFieldsMap);
    };

    if (widgetStats && widgetStats.length > 0) {
      fetchCustomFields();
    }
  }, [widgetStats, workspaceSlug]);

  if (!widgetStats) return <WidgetLoader widgetKey={WIDGET_KEY} />;

  return (
    <Card>
      <Link href={redirectionLink} className="text-lg font-semibold text-custom-text-300 hover:underline mb-4">
        최근 활동
      </Link>
      {widgetStats.length > 0 ? (
        <div className="mt-4 space-y-6">
          {widgetStats.map((activity) => {
            const projectCustomFields = customFieldsByProject[activity.project] || [];
            
            return (
              <div key={activity.id} className="flex gap-5">
                <div className="flex-shrink-0">
                  {activity.field ? (
                    activity.new_value === "restore" ? (
                      <History className="h-3.5 w-3.5 text-custom-text-200" />
                    ) : (
                      <div className="flex h-6 w-6 justify-center">
                        <ActivityIcon activity={activity} customFields={projectCustomFields} />
                      </div>
                    )
                  ) : activity.actor_detail.avatar_url && activity.actor_detail.avatar_url !== "" ? (
                    <Avatar
                      src={getFileURL(activity.actor_detail.avatar_url)}
                      name={activity.actor_detail.display_name}
                      size={24}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-gray-700 text-xs text-white">
                      {activity.actor_detail.is_bot
                        ? activity.actor_detail.first_name.charAt(0)
                        : activity.actor_detail.display_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="-mt-2 break-words">
                  <p className="inline text-sm text-custom-text-200">
                    <span className="font-medium text-custom-text-100">
                      {currentUser?.id === activity.actor_detail.id ? "당신이" : activity.actor_detail?.display_name + " 님이"}{" "}
                    </span>
                    {activity.field ? (
                      <ActivityMessage activity={activity} showIssue customFields={projectCustomFields} />
                    ) : (
                      <span>
                        <IssueLink activity={activity} /> 생성 하였습니다.
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-custom-text-200 whitespace-nowrap">
                    {calculateTimeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <Link
            href={redirectionLink}
            className={cn(
              getButtonStyling("link-primary", "sm"),
              "mx-auto w-min px-2 py-1 text-xs hover:bg-custom-primary-100/20"
            )}
          >
            모든 활동 보기
          </Link>
        </div>
      ) : (
        <div className="grid h-full place-items-center">
          <RecentActivityEmptyState />
        </div>
      )}
    </Card>
  );
});
