import type { SyntheticEvent } from "react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { xor } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { Link, Paperclip } from "lucide-react";
// types
import { WORK_ITEM_TRACKER_EVENTS } from "@plane/constants";
// i18n
import { useTranslation } from "@plane/i18n";
import { StartDatePropertyIcon, ViewsIcon, DueDatePropertyIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue, IIssueDisplayProperties, TIssuePriorities, TCustomField } from "@plane/types";
// ui
import {
  cn,
  getDate,
  renderFormattedPayloadDate,
  generateWorkItemLink,
  shouldHighlightIssueDueDate,
} from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// components
import { CycleDropdown } from "@/components/dropdowns/cycle";
import { DateDropdown } from "@/components/dropdowns/date";
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { ModuleDropdown } from "@/components/dropdowns/module/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
// helpers
import { captureSuccess } from "@/helpers/event-tracker.helper";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useAppRouter } from "@/hooks/use-app-router";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web components
import { WorkItemLayoutAdditionalProperties } from "@/plane-web/components/issues/issue-layouts/additional-properties";
// local components
import { IssuePropertyLabels } from "./labels";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";
import { IssueCustomFieldProperties } from "./custom-field-properties";

export interface IIssueProperties {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  isReadOnly: boolean;
  className: string;
  activeLayout: string;
  isEpic?: boolean;
  customFields?: TCustomField[];
}

export const IssueProperties = observer(function IssueProperties(props: IIssueProperties) {
  const {
    issue,
    updateIssue,
    displayProperties,
    isReadOnly,
    className,
    activeLayout,
    isEpic = false,
    customFields = [],
  } = props;
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const { labelMap } = useLabel();
  const storeType = useIssueStoreType();
  const {
    issues: { changeModulesInIssue },
  } = useIssues(storeType);
  const {
    issues: { addCycleToIssue, removeCycleFromIssue },
  } = useIssues(storeType);
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const { getStateById } = useProjectState();
  const { isMobile } = usePlatformOS();
  const projectDetails = getProjectById(issue.project_id);

  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();

  // derived values
  const stateDetails = getStateById(issue.state_id);
  const subIssueCount = issue?.sub_issues_count ?? 0;

  const issueOperations = useMemo(
    () => ({
      addModulesToIssue: async (moduleIds: string[]) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await changeModulesInIssue?.(workspaceSlug.toString(), issue.project_id, issue.id, moduleIds, []);
      },
      removeModulesFromIssue: async (moduleIds: string[]) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await changeModulesInIssue?.(workspaceSlug.toString(), issue.project_id, issue.id, [], moduleIds);
      },
      addIssueToCycle: async (cycleId: string) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await addCycleToIssue?.(workspaceSlug.toString(), issue.project_id, cycleId, issue.id);
      },
      removeIssueFromCycle: async () => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await removeCycleFromIssue?.(workspaceSlug.toString(), issue.project_id, issue.id);
      },
    }),
    [workspaceSlug, issue, changeModulesInIssue, addCycleToIssue, removeCycleFromIssue]
  );

  const handleState = (stateId: string) => {
    if (updateIssue)
      updateIssue(issue.project_id, issue.id, { state_id: stateId })
        .then(() => {
          captureSuccess({
            eventName: WORK_ITEM_TRACKER_EVENTS.update,
            payload: { id: issue.id },
          });
        })
        .catch((error) => {
          console.error("State update failed:", error);
          console.error("Error details:", {
            status: error?.response?.status,
            data: error?.response?.data,
            message: error?.message,
          });

          // Extract and show detailed error message
          let errorMessage = "작업 항목 업데이트 실패";
          let errorTitle = "상태 변경 실패";

          // Handle workflow-specific errors
          if (error?.response?.status === 400) {
            if (error?.response?.data?.non_field_errors?.[0]) {
              errorMessage = error.response.data.non_field_errors[0];
            } else if (error?.response?.data?.detail) {
              errorMessage = error.response.data.detail;
            } else if (error?.response?.data?.error) {
              errorMessage = error.response.data.error;
            }

            // Check for workflow-related errors
            if (
              errorMessage.includes("workflow") ||
              errorMessage.includes("transition") ||
              errorMessage.includes("승인")
            ) {
              errorTitle = "워크플로우 규칙 위반";
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }

          setToast({
            type: TOAST_TYPE.ERROR,
            title: errorTitle,
            message: errorMessage,
          });
        });
  };

  const handlePriority = (value: TIssuePriorities) => {
    if (updateIssue)
      updateIssue(issue.project_id, issue.id, { priority: value }).then(() => {
        captureSuccess({
          eventName: WORK_ITEM_TRACKER_EVENTS.update,
          payload: { id: issue.id },
        });
      });
  };

  const handleLabel = (ids: string[]) => {
    if (updateIssue)
      updateIssue(issue.project_id, issue.id, { label_ids: ids }).then(() => {
        captureSuccess({
          eventName: WORK_ITEM_TRACKER_EVENTS.update,
          payload: { id: issue.id },
        });
      });
  };

  const handleAssignee = (ids: string[]) => {
    if (updateIssue)
      updateIssue(issue.project_id, issue.id, { assignee_ids: ids }).then(() => {
        captureSuccess({
          eventName: WORK_ITEM_TRACKER_EVENTS.update,
          payload: { id: issue.id },
        });
      });
  };

  const handleModule = useCallback(
    (moduleIds: string[] | null) => {
      if (!issue || !issue.module_ids || !moduleIds) return;

      const updatedModuleIds = xor(issue.module_ids, moduleIds);
      const modulesToAdd: string[] = [];
      const modulesToRemove: string[] = [];
      for (const moduleId of updatedModuleIds)
        if (issue.module_ids.includes(moduleId)) modulesToRemove.push(moduleId);
        else modulesToAdd.push(moduleId);
      if (modulesToAdd.length > 0) issueOperations.addModulesToIssue(modulesToAdd);
      if (modulesToRemove.length > 0) issueOperations.removeModulesFromIssue(modulesToRemove);

      captureSuccess({
        eventName: WORK_ITEM_TRACKER_EVENTS.update,
        payload: { id: issue.id },
      });
    },
    [issueOperations, issue]
  );

  const handleCycle = useCallback(
    (cycleId: string | null) => {
      if (!issue || issue.cycle_id === cycleId) return;
      if (cycleId) issueOperations.addIssueToCycle?.(cycleId);
      else issueOperations.removeIssueFromCycle?.();

      captureSuccess({
        eventName: WORK_ITEM_TRACKER_EVENTS.update,
        payload: { id: issue.id },
      });
    },
    [issue, issueOperations]
  );

  const handleStartDate = (date: Date | null) => {
    if (updateIssue)
      updateIssue(issue.project_id, issue.id, { start_date: date ? renderFormattedPayloadDate(date) : null }).then(
        () => {
          captureSuccess({
            eventName: WORK_ITEM_TRACKER_EVENTS.update,
            payload: { id: issue.id },
          });
        }
      );
  };

  const handleTargetDate = (date: Date | null) => {
    if (updateIssue)
      updateIssue(issue.project_id, issue.id, { target_date: date ? renderFormattedPayloadDate(date) : null }).then(
        () => {
          captureSuccess({
            eventName: WORK_ITEM_TRACKER_EVENTS.update,
            payload: { id: issue.id },
          });
        }
      );
  };

  const handleEstimate = (value: string | undefined) => {
    if (updateIssue)
      updateIssue(issue.project_id, issue.id, { estimate_point: value }).then(() => {
        captureSuccess({
          eventName: WORK_ITEM_TRACKER_EVENTS.update,
          payload: { id: issue.id },
        });
      });
  };

  const workItemLink = generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: issue?.project_id,
    issueId: issue?.id,
    projectIdentifier: projectDetails?.identifier,
    sequenceId: issue?.sequence_id,
    isArchived: !!issue?.archived_at,
    isEpic,
  });

  const redirectToIssueDetail = () => router.push(`${workItemLink}#sub-issues`);

  if (!displayProperties || !issue.project_id) return null;

  // date range is enabled only when both dates are available and both dates are enabled
  const isDateRangeEnabled: boolean = Boolean(
    issue.start_date && issue.target_date && displayProperties.start_date && displayProperties.due_date
  );

  const defaultLabelOptions = issue?.label_ids?.map((id) => labelMap[id]) || [];

  const minDate = getDate(issue.start_date);
  const maxDate = getDate(issue.target_date);

  const handleEventPropagation = (e: SyntheticEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className={className}>
      {/* basic properties */}
      {/* state */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="state">
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <StateDropdown
            buttonContainerClassName="truncate max-w-40"
            value={issue.state_id}
            onChange={handleState}
            projectId={issue.project_id}
            disabled={isReadOnly}
            buttonVariant="border-with-text"
            renderByDefault={isMobile}
            showTooltip
            issueId={issue.id}
            enableWorkflowValidation={true}
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* priority */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="priority">
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <PriorityDropdown
            value={issue?.priority}
            onChange={handlePriority}
            disabled={isReadOnly}
            buttonVariant="border-without-text"
            buttonClassName="border"
            renderByDefault={isMobile}
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* merged dates */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey={["start_date", "due_date"]}
        shouldRenderProperty={() => isDateRangeEnabled}
      >
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <DateRangeDropdown
            value={{
              from: getDate(issue.start_date) || undefined,
              to: getDate(issue.target_date) || undefined,
            }}
            onSelect={(range) => {
              handleStartDate(range?.from ?? null);
              handleTargetDate(range?.to ?? null);
            }}
            hideIcon={{
              from: false,
            }}
            isClearable
            mergeDates
            buttonVariant={issue.start_date || issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group) ? "text-red-500" : ""}
            clearIconClassName="!text-custom-text-100"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            renderPlaceholder={false}
            customTooltipHeading="Date Range"
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* start date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="start_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <DateDropdown
            value={issue.start_date ?? null}
            onChange={handleStartDate}
            maxDate={maxDate}
            placeholder={t("common.order_by.start_date")}
            icon={<StartDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.start_date ? "border-with-text" : "border-without-text"}
            optionsClassName="z-10"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* target/due date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="due_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <DateDropdown
            value={issue?.target_date ?? null}
            onChange={handleTargetDate}
            minDate={minDate}
            placeholder={t("common.order_by.due_date")}
            icon={<DueDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group) ? "text-red-500" : ""}
            clearIconClassName="!text-custom-text-100"
            optionsClassName="z-10"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* assignee */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="assignee">
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <MemberDropdown
            projectId={issue?.project_id}
            value={issue?.assignee_ids}
            onChange={handleAssignee}
            disabled={isReadOnly}
            multiple
            buttonVariant={issue.assignee_ids?.length > 0 ? "transparent-without-text" : "border-without-text"}
            buttonClassName={issue.assignee_ids?.length > 0 ? "hover:bg-transparent px-0" : ""}
            showTooltip={issue?.assignee_ids?.length === 0}
            placeholder={t("common.assignees")}
            optionsClassName="z-10"
            tooltipContent=""
            renderByDefault={isMobile}
          />
        </div>
      </WithDisplayPropertiesHOC>

      <>
        {!isEpic && (
          <>
            {/* modules */}
            {projectDetails?.module_view && (
              <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="modules">
                <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
                  <ModuleDropdown
                    buttonContainerClassName="truncate max-w-40"
                    projectId={issue?.project_id}
                    value={issue?.module_ids ?? []}
                    onChange={handleModule}
                    disabled={isReadOnly}
                    renderByDefault={isMobile}
                    multiple
                    buttonVariant="border-with-text"
                    showCount
                    showTooltip
                  />
                </div>
              </WithDisplayPropertiesHOC>
            )}

            {/* cycles */}
            {projectDetails?.cycle_view && (
              <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="cycle">
                <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
                  <CycleDropdown
                    buttonContainerClassName="truncate max-w-40"
                    projectId={issue?.project_id}
                    value={issue?.cycle_id}
                    onChange={handleCycle}
                    disabled={isReadOnly}
                    buttonVariant="border-with-text"
                    renderByDefault={isMobile}
                    showTooltip
                  />
                </div>
              </WithDisplayPropertiesHOC>
            )}
          </>
        )}
      </>

      {/* estimates */}
      {projectId && areEstimateEnabledByProjectId(projectId?.toString()) && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="estimate">
          <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <EstimateDropdown
              value={issue.estimate_point} // null 값을 그대로 전달하여 controlled 상태 유지
              onChange={handleEstimate}
              projectId={issue.project_id}
              disabled={isReadOnly}
              buttonVariant="border-with-text"
              renderByDefault={isMobile}
              showTooltip
            />
          </div>
        </WithDisplayPropertiesHOC>
      )}

      {/* extra render properties */}
      {/* sub-issues */}
      {!isEpic && (
        <WithDisplayPropertiesHOC
          displayProperties={displayProperties}
          displayPropertyKey="sub_issue_count"
          shouldRenderProperty={(properties) => !!properties.sub_issue_count && !!subIssueCount}
        >
          <Tooltip
            tooltipHeading={t("common.sub_work_items")}
            tooltipContent={`${subIssueCount}`}
            isMobile={isMobile}
            renderByDefault={false}
          >
            <div
              onFocus={handleEventPropagation}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (subIssueCount) redirectToIssueDetail();
              }}
              className={cn(
                "flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded border-[0.5px] border-custom-border-300 px-2.5 py-1",
                {
                  "hover:bg-custom-background-80 cursor-pointer": subIssueCount,
                }
              )}
            >
              <ViewsIcon className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
              <div className="text-xs">{subIssueCount}</div>
            </div>
          </Tooltip>
        </WithDisplayPropertiesHOC>
      )}

      {/* attachments */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="attachment_count"
        shouldRenderProperty={(properties) => !!properties.attachment_count && !!issue.attachment_count}
      >
        <Tooltip
          tooltipHeading={t("common.attachments")}
          tooltipContent={`${issue.attachment_count}`}
          isMobile={isMobile}
          renderByDefault={false}
        >
          <div
            className="flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded border-[0.5px] border-custom-border-300 px-2.5 py-1"
            onFocus={handleEventPropagation}
            onClick={handleEventPropagation}
          >
            <Paperclip className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
            <div className="text-xs">{issue.attachment_count}</div>
          </div>
        </Tooltip>
      </WithDisplayPropertiesHOC>

      {/* link */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="link"
        shouldRenderProperty={(properties) => !!properties.link && !!issue.link_count}
      >
        <Tooltip
          tooltipHeading={t("common.links")}
          tooltipContent={`${issue.link_count}`}
          isMobile={isMobile}
          renderByDefault={false}
        >
          <div
            className="flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded border-[0.5px] border-custom-border-300 px-2.5 py-1"
            onFocus={handleEventPropagation}
            onClick={handleEventPropagation}
          >
            <Link className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
            <div className="text-xs">{issue.link_count}</div>
          </div>
        </Tooltip>
      </WithDisplayPropertiesHOC>

      {/* Additional Properties */}
      <WorkItemLayoutAdditionalProperties displayProperties={displayProperties} issue={issue} />

      {/* Custom Fields */}
      <IssueCustomFieldProperties
        issue={issue}
        updateIssue={updateIssue}
        isReadOnly={isReadOnly}
        activeLayout={activeLayout}
        displayProperties={displayProperties}
        customFields={customFields || []}
      />

      {/* label */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="labels">
        <IssuePropertyLabels
          projectId={issue?.project_id || null}
          value={issue?.label_ids || []}
          defaultOptions={defaultLabelOptions}
          onChange={handleLabel}
          disabled={isReadOnly}
          renderByDefault={isMobile}
          hideDropdownArrow
          maxRender={3}
        />
      </WithDisplayPropertiesHOC>
    </div>
  );
});
