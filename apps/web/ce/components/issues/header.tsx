import axios from "axios";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
// icons
import { CheckCircle, Circle, Edit3, ExternalLink, Upload } from "lucide-react";
// plane imports
import {
  EUserPermissions,
  EUserPermissionsLevel,
  SPACE_BASE_PATH,
  SPACE_BASE_URL,
  WORK_ITEM_TRACKER_ELEMENTS,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { WorkItemsIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EIssuesStoreType, TIssue } from "@plane/types";
import { Breadcrumbs, Header } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { CountChip } from "@/components/common/count-chip";
// constants
import { HeaderFilters } from "@/components/issues/filters";
// helpers
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkflowApproval } from "@/hooks/store/use-workflow-approval";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";
import { BulkEditModal } from "./bulk-operations/bulk-edit-modal";
import { IssueUploadModal } from "./issue-uploader/issue-upload-modal";
import { WorkflowApprovalModal } from "./workflow-approval-modal";

export const IssuesHeader = observer(function IssuesHeader() {
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const {
    issues: { getGroupIssueCount },
    issuesFilter: { issueFilters },
  } = useIssues(EIssuesStoreType.PROJECT);
  // i18n
  const { t } = useTranslation();

  const { fetchIssues } = useIssuesActions(EIssuesStoreType.PROJECT);
  const { isSelectionActive, selectedEntityIds, clearSelection } = useMultipleSelectStore();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { currentProjectDetails, loader } = useProject();

  const { toggleCreateIssueModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();
  const { isMobile } = usePlatformOS();
  const { approvalCount, refreshApprovalCount } = useWorkflowApproval();

  const SPACE_APP_URL = (SPACE_BASE_URL.trim() === "" ? window.location.origin : SPACE_BASE_URL) + SPACE_BASE_PATH;
  const publishedURL = `${SPACE_APP_URL}/issues/${currentProjectDetails?.anchor}`;

  const issuesCount = getGroupIssueCount(undefined, undefined, false);
  const canUserCreateIssue = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const perPageCount = Number(issueFilters?.displayFilters?.per_page || 100);

  const selectedIssuesList = useMemo(
    () =>
      selectedEntityIds.map((issueId) => getIssueById(issueId)).filter((issue): issue is TIssue => issue !== undefined),
    [selectedEntityIds, getIssueById]
  );

  const hasSelection = isSelectionActive && selectedIssuesList.length > 0;

  const handleUpload = async (file: File) => {
    if (!workspaceSlug || !projectId) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      await axios.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/import-issues/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("issue.upload.success"),
      });

      await fetchIssues("mutation", {
        canGroup: true,
        perPageCount,
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("issue.upload.error"),
      });
      throw error;
    }
  };

  const handleBulkUpdate = async (bulkUpdatePayload: { issue_ids: string[]; properties: unknown }) => {
    if (!workspaceSlug || !projectId) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/bulk-operation-issues/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(bulkUpdatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update work items.");
      }

      const result = await response.json();
      let message = `${result.updated_issues || 0}${t("issue.bulk_edit.success_suffix", { defaultValue: "개 작업 항목이 성공적으로 업데이트되었습니다." })}`;
      if (result.skipped_issues && result.skipped_issues > 0) {
        message += ` ${result.skipped_issues}${t("issue.bulk_edit.skipped_suffix", { defaultValue: "개 작업 항목은 권한이 없어 건너뛰었습니다." })}`;
      }

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: message,
      });

      await fetchIssues("mutation", {
        canGroup: true,
        perPageCount,
      });

      clearSelection();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: `${t("issue.bulk_edit.error_prefix", { defaultValue: "업데이트 중 오류가 발생했습니다" })}: ${error instanceof Error ? error.message : String(error)}`,
      });
      throw error;
    }
  };

  return (
    <>
      <Header>
        <Header.LeftItem>
          <div className="flex items-center gap-2.5">
            <Breadcrumbs onBack={() => router.back()} isLoading={loader === "init-loader"} className="flex-grow-0">
              <CommonProjectBreadcrumbs
                workspaceSlug={workspaceSlug?.toString() ?? ""}
                projectId={projectId?.toString() ?? ""}
              />
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink
                    label="Work Items"
                    href={`/${workspaceSlug}/projects/${projectId}/issues/`}
                    icon={<WorkItemsIcon className="h-4 w-4 text-custom-text-300" />}
                    isLast
                  />
                }
                isLast
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
          ) : null}
        </Header.LeftItem>
        <Header.RightItem>
          <div className="hidden items-center gap-2 md:flex">
            <HeaderFilters
              projectId={projectId}
              currentProjectDetails={currentProjectDetails}
              workspaceSlug={workspaceSlug}
              canUserCreateIssue={canUserCreateIssue}
            />
            {canUserCreateIssue ? (
              <>
                <Button
                  variant="neutral-primary"
                  size="sm"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="hidden sm:flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {t("issue.upload.button", { defaultValue: "Import" })}
                </Button>
                {hasSelection ? (
                  <Button
                    variant="neutral-primary"
                    size="sm"
                    onClick={() => setIsBulkEditModalOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    {t("issue.bulk_edit.label", { defaultValue: "Bulk edit" })}
                    <span className="text-xs text-custom-text-200">({selectedIssuesList.length})</span>
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button
              variant={approvalCount > 0 ? "primary" : "neutral-primary"}
              size="sm"
              onClick={() => setIsApprovalModalOpen(true)}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {t("workflow.approval.button", { defaultValue: "Approval requests" })}
              {approvalCount > 0 ? <span className="text-xs">({approvalCount})</span> : null}
            </Button>
          </div>
          {canUserCreateIssue ? (
            <Button
              onClick={() => {
                toggleCreateIssueModal(true, EIssuesStoreType.PROJECT);
              }}
              data-ph-element={WORK_ITEM_TRACKER_ELEMENTS.HEADER_ADD_BUTTON.WORK_ITEMS}
              size="sm"
            >
              <div className="block sm:hidden">{t("issue.label", { count: 1 })}</div>
              <div className="hidden sm:block">{t("issue.add.label")}</div>
            </Button>
          ) : null}
        </Header.RightItem>
      </Header>

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
      <WorkflowApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          refreshApprovalCount();
        }}
        onApprovalProcessed={() => refreshApprovalCount()}
      />
    </>
  );
});
