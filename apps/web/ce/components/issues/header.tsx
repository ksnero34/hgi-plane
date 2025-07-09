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
// types
import { TIssue } from "@plane/types";
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
    issuesFilter,
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
          perPageCount: issuesFilter?.issueFilters?.displayFilters?.per_page || 100
        }
      );
      
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("issue.upload.error"),
      });
    }
  };

  const handleBulkUpdate = async (bulkUpdatePayload: any) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/projects/${projectId}/bulk-operation-issues/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(bulkUpdatePayload),
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        // 성공 메시지 표시
        let message = `${result.updated_issues || 0}개 작업 항목이 성공적으로 업데이트되었습니다.`;
        
        // 권한으로 인해 건너뛴 이슈가 있는 경우 경고 메시지 추가
        if (result.skipped_issues && result.skipped_issues > 0) {
          message += ` ${result.skipped_issues}개 작업 항목은 권한이 없어 건너뛰었습니다.`;
        }

        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: message,
        });

        // 이슈 목록 새로고침
        await fetchIssues(
          "mutation",
          {
            canGroup: true,
            perPageCount: issuesFilter?.issueFilters?.displayFilters?.per_page || 100
          }
        );

        // 선택 해제
        clearSelection();
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "업데이트에 실패했습니다.");
      }
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: `업데이트 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  // 선택된 이슈들의 데이터를 가져오기 (완전한 이슈 데이터가 있는 것만)
  const selectedIssuesList = selectedEntityIds
    .map(issueId => getIssueById(issueId))
    .filter((issue): issue is TIssue => issue !== undefined);

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
