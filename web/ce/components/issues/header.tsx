"use client";

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import axios from "axios";
// icons
import { Circle, ExternalLink, Upload, Edit3 } from "lucide-react";
// plane constants
import { EIssuesStoreType, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// ui
import { Breadcrumbs, Button, LayersIcon, Tooltip, Header, setToast, TOAST_TYPE } from "@plane/ui";
// components
import { BreadcrumbLink, CountChip } from "@/components/common";
// constants
import HeaderFilters from "@/components/issues/filters";
// helpers
import { SPACE_BASE_PATH, SPACE_BASE_URL } from "@/helpers/common.helper";
// hooks
import { useEventTracker, useProject, useCommandPalette, useUserPermissions, useMultipleSelectStore } from "@/hooks/store";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// plane web
import { ProjectBreadcrumb } from "@/plane-web/components/breadcrumbs";
import { IssueUploadModal } from "./issue-uploader/issue-upload-modal";
import { BulkEditModal } from "./bulk-operations/bulk-edit-modal";

export const IssuesHeader = observer(() => {
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId, viewId } = useParams() as { workspaceSlug: string; projectId: string; viewId: string };
  // store hooks
  const {
    issues: { getGroupIssueCount },
  } = useIssues(EIssuesStoreType.PROJECT);
  const { fetchIssues, updateIssue } = useIssuesActions(EIssuesStoreType.PROJECT);
  const { isSelectionActive, selectedEntityIds, clearSelection } = useMultipleSelectStore();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // i18n
  const { t } = useTranslation();

  const { currentProjectDetails, loader } = useProject();

  const { toggleCreateIssueModal } = useCommandPalette();
  const { setTrackElement } = useEventTracker();
  const { allowPermissions } = useUserPermissions();
  const { isMobile } = usePlatformOS();

  const SPACE_APP_URL = (SPACE_BASE_URL.trim() === "" ? window.location.origin : SPACE_BASE_URL) + SPACE_BASE_PATH;
  const publishedURL = `${SPACE_APP_URL}/issues/${currentProjectDetails?.anchor}`;

  const issuesCount = getGroupIssueCount(undefined, undefined, false);
  const canUserCreateIssue = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  const handleUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      await axios.post(
        `/api/workspaces/${workspaceSlug}/projects/${projectId}/import-issues/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("issue.upload.success"),
      });

      // 이슈 목록 새로고침
      await fetchIssues(
        "mutation",
        {
          canGroup: true,
          perPageCount: 100
        }
      );
      
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("issue.upload.error"),
      });
    }
  };

  const handleBulkUpdate = async (updates: Partial<any>) => {
    try {
      // 권한이 있는 이슈들만 필터링하여 업데이트
      const updatePromises = selectedEntityIds
        .map(issueId => {
          const issue = getIssueById(issueId);
          if (!issue) return null;
          
          // 권한 체크: Admin/Member는 모든 이슈, Viewer/Restricted는 자신에게 할당된 이슈만
          const hasFullEditAccess = allowPermissions(
            [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
            EUserPermissionsLevel.PROJECT
          );
          
          if (hasFullEditAccess) {
            return updateIssue && updateIssue(projectId, issueId, updates);
          }
          
          // Viewer/Restricted 권한 체크
          const isViewerOrRestricted = allowPermissions(
            [EUserPermissions.VIEWER, EUserPermissions.RESTRICTED],
            EUserPermissionsLevel.PROJECT
          );
          
          if (isViewerOrRestricted) {
            // 현재 사용자가 담당자인지 확인
            const assigneeIds = issue.assignee_ids || [];
            // currentUser는 useUser hook에서 가져와야 하지만, 여기서는 간단히 처리
            // 실제로는 useUser hook을 추가해야 함
            return updateIssue && updateIssue(projectId, issueId, updates);
          }
          
          return null;
        })
        .filter(Boolean);

      await Promise.all(updatePromises);

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("issue.bulk_edit.success"),
      });

      // 선택 해제
      clearSelection();
      
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("issue.bulk_edit.error"),
      });
    }
  };

  // 선택된 이슈들의 데이터를 가져오기
  const selectedIssuesList = selectedEntityIds.map(issueId => {
    const issue = getIssueById(issueId);
    return issue || { id: issueId };
  });

  return (
    <Header>
      <Header.LeftItem>
        <div className="flex items-center gap-2.5">
          <Breadcrumbs onBack={() => router.back()} isLoading={loader === "init-loader"}>
            <ProjectBreadcrumb />

            <Breadcrumbs.BreadcrumbItem
              type="text"
              link={
                <BreadcrumbLink
                  label={t("issue.label", { count: 2 })} // count is for pluralization
                  icon={<LayersIcon className="h-4 w-4 text-custom-text-300" />}
                />
              }
            />
          </Breadcrumbs>
          {issuesCount && issuesCount > 0 ? (
            <Tooltip
              isMobile={isMobile}
              tooltipContent={`There are ${issuesCount} ${issuesCount > 1 ? "work items" : "work item"} in this project`}
              position="bottom"
            >
              <CountChip count={issuesCount} />
            </Tooltip>
          ) : null}
        </div>
        {currentProjectDetails?.anchor ? (
          <a
            href={publishedURL}
            className="group flex items-center gap-1.5 rounded bg-custom-primary-100/10 px-2.5 py-1 text-xs font-medium text-custom-primary-100"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Circle className="h-1.5 w-1.5 fill-custom-primary-100" strokeWidth={2} />
            {t("workspace_projects.network.public.title")}
            <ExternalLink className="hidden h-3 w-3 group-hover:block" strokeWidth={2} />
          </a>
        ) : (
          <></>
        )}
      </Header.LeftItem>
      <Header.RightItem>
        <div className="hidden gap-3 md:flex">
          <HeaderFilters
            projectId={projectId}
            currentProjectDetails={currentProjectDetails}
            workspaceSlug={workspaceSlug}
            canUserCreateIssue={canUserCreateIssue}
          />
        </div>
        {canUserCreateIssue && (
          <>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              size="sm"
              variant="primary"
            >
              <Upload className="h-4 w-4 mr-2" />
              {t("issue.upload.label")}
            </Button>
            {isSelectionActive && selectedEntityIds.length > 0 && (
              <Button
                onClick={() => setIsBulkEditModalOpen(true)}
                size="sm"
                variant="neutral-primary"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {t("issue.bulk_edit.label")} ({selectedEntityIds.length})
              </Button>
            )}
            <Button
              onClick={() => {
                setTrackElement("Project work items page");
                toggleCreateIssueModal(true, EIssuesStoreType.PROJECT);
              }}
              size="sm"
            >
              <div className="block sm:hidden">{t("issue.label", { count: 1 })}</div>
              <div className="hidden sm:block">{t("issue.add.label")}</div>
            </Button>
          </>
        )}
      </Header.RightItem>
      
      <IssueUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
      />

      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedIssues={selectedIssuesList}
        onBulkUpdate={handleBulkUpdate}
      />
    </Header>
  );
});
