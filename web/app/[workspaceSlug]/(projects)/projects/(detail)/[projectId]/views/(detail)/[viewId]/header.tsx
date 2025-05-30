"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Layers, Lock } from "lucide-react";
// plane constants
import {
  EIssueLayoutTypes,
  EIssueFilterType,
  EIssuesStoreType,
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
  EViewAccess,
  EUserPermissions,
  EUserPermissionsLevel,
} from "@plane/constants";
// types
import {
  ICustomSearchSelectOption,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilterOptions,
  TCustomField,
} from "@plane/types";
// ui
import { Breadcrumbs, Button, Tooltip, Header, CustomSearchSelect } from "@plane/ui";
// components
import { BreadcrumbLink, SwitcherLabel } from "@/components/common";
import { DisplayFiltersSelection, FiltersDropdown, FilterSelection, LayoutSelection } from "@/components/issues";
// constants
import { ViewQuickActions } from "@/components/views";
// helpers
import { isIssueFilterActive } from "@/helpers/filter.helper";
// hooks
import {
  useCommandPalette,
  useEventTracker,
  useIssues,
  useLabel,
  useMember,
  useProject,
  useProjectState,
  useProjectView,
  useUserPermissions,
} from "@/hooks/store";
// plane web
import { useAppRouter } from "@/hooks/use-app-router";
import { ProjectBreadcrumb } from "@/plane-web/components/breadcrumbs";

export const ProjectViewIssuesHeader: React.FC = observer(() => {
  // refs
  const parentRef = useRef(null);
  // states
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  // router
  const { workspaceSlug, projectId, viewId } = useParams();
  const router = useAppRouter();
  // store hooks
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(EIssuesStoreType.PROJECT_VIEW);
  const { setTrackElement } = useEventTracker();
  const { toggleCreateIssueModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();

  const { currentProjectDetails, loader } = useProject();
  const { projectViewIds, getViewById } = useProjectView();
  const { projectStates } = useProjectState();
  const { projectLabels } = useLabel();
  const {
    project: { projectMemberIds },
  } = useMember();

  // 커스텀 필드 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!workspaceSlug || !projectId) return;

      try {
        // console.log("ProjectViewIssuesHeader - Fetching custom fields");
        const response = await fetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          // console.log("ProjectViewIssuesHeader - Custom fields loaded:", data);
          setCustomFields(data || []);
        } else {
          setCustomFields([]);
        }
      } catch (error) {
        console.error("커스텀 필드 로드 중 오류:", error);
        setCustomFields([]);
      }
    };

    fetchCustomFields();
  }, [workspaceSlug, projectId]);

  const activeLayout = issueFilters?.displayFilters?.layout;

  const handleLayoutChange = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (!workspaceSlug || !projectId || !viewId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_FILTERS,
        { layout: layout },
        viewId.toString()
      );
    },
    [workspaceSlug, projectId, viewId, updateFilters]
  );

  const handleFiltersUpdate = useCallback(
    (key: keyof IIssueFilterOptions, value: string | string[]) => {
      if (!workspaceSlug || !projectId || !viewId) return;

      // custom_fields는 별도 처리
      if (key === "custom_fields") {
        updateFilters(
          workspaceSlug.toString(),
          projectId.toString(),
          EIssueFilterType.FILTERS,
          { [key]: value },
          viewId.toString()
        );
        return;
      }

      const newValues = issueFilters?.filters?.[key] ?? [];

      if (Array.isArray(value)) {
        // this validation is majorly for the filter start_date, target_date custom
        value.forEach((val) => {
          if (!newValues.includes(val)) newValues.push(val);
          else newValues.splice(newValues.indexOf(val), 1);
        });
      } else {
        if (issueFilters?.filters?.[key]?.includes(value)) newValues.splice(newValues.indexOf(value), 1);
        else newValues.push(value);
      }

      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.FILTERS,
        { [key]: newValues },
        viewId.toString()
      );
    },
    [workspaceSlug, projectId, viewId, issueFilters, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId || !viewId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_FILTERS,
        updatedDisplayFilter,
        viewId.toString()
      );
    },
    [workspaceSlug, projectId, viewId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId || !viewId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_PROPERTIES,
        property,
        viewId.toString()
      );
    },
    [workspaceSlug, projectId, viewId, updateFilters]
  );

  const viewDetails = viewId ? getViewById(viewId.toString()) : null;

  const canUserCreateIssue = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  if (!viewDetails) return;

  const switcherOptions = projectViewIds
    ?.map((id) => {
      const _view = id === viewId ? viewDetails : getViewById(id);
      if (!_view) return;
      return {
        value: _view.id,
        query: _view.name,
        content: <SwitcherLabel logo_props={_view.logo_props} name={_view.name} LabelIcon={Layers} />,
      };
    })
    .filter((option) => option !== undefined) as ICustomSearchSelectOption[];

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs isLoading={loader === "init-loader"}>
          <ProjectBreadcrumb />
          <Breadcrumbs.BreadcrumbItem
            type="text"
            link={
              <BreadcrumbLink
                href={`/${workspaceSlug}/projects/${currentProjectDetails?.id}/views`}
                label="Views"
                icon={<Layers className="h-4 w-4 text-custom-text-300" />}
              />
            }
          />
          <Breadcrumbs.BreadcrumbItem
            type="component"
            component={
              <CustomSearchSelect
                options={switcherOptions}
                value={viewId}
                label={<SwitcherLabel logo_props={viewDetails.logo_props} name={viewDetails.name} LabelIcon={Layers} />}
                onChange={(value: string) => {
                  router.push(`/${workspaceSlug}/projects/${projectId}/views/${value}`);
                }}
              />
            }
          />
        </Breadcrumbs>

        {viewDetails?.access === EViewAccess.PRIVATE ? (
          <div className="cursor-default text-custom-text-300">
            <Tooltip tooltipContent={"Private"}>
              <Lock className="h-4 w-4" />
            </Tooltip>
          </div>
        ) : (
          <></>
        )}
      </Header.LeftItem>
      <Header.RightItem className="items-center">
        {!viewDetails?.is_locked ? (
          <>
            <LayoutSelection
              layouts={[
                EIssueLayoutTypes.LIST,
                EIssueLayoutTypes.KANBAN,
                EIssueLayoutTypes.CALENDAR,
                EIssueLayoutTypes.SPREADSHEET,
                EIssueLayoutTypes.GANTT,
              ]}
              onChange={(layout) => handleLayoutChange(layout)}
              selectedLayout={activeLayout}
            />

            <FiltersDropdown
              title="필터"
              placement="bottom-end"
              disabled={!canUserCreateIssue}
              isFiltersApplied={isIssueFilterActive(issueFilters)}
            >
              <FilterSelection
                filters={issueFilters?.filters ?? {}}
                handleFiltersUpdate={handleFiltersUpdate}
                displayFilters={issueFilters?.displayFilters ?? {}}
                handleDisplayFiltersUpdate={handleDisplayFilters}
                layoutDisplayFiltersOptions={
                  activeLayout ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues[activeLayout] : undefined
                }
                projectId={projectId.toString()}
                labels={projectLabels}
                memberIds={projectMemberIds ?? undefined}
                states={projectStates}
                cycleViewDisabled={!currentProjectDetails?.cycle_view}
                moduleViewDisabled={!currentProjectDetails?.module_view}
                customFields={customFields}
              />
            </FiltersDropdown>
            <FiltersDropdown title="Display" placement="bottom-end">
              <DisplayFiltersSelection
                layoutDisplayFiltersOptions={
                  activeLayout ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues[activeLayout] : undefined
                }
                displayFilters={issueFilters?.displayFilters ?? {}}
                handleDisplayFiltersUpdate={handleDisplayFilters}
                displayProperties={issueFilters?.displayProperties ?? {}}
                handleDisplayPropertiesUpdate={handleDisplayProperties}
                cycleViewDisabled={!currentProjectDetails?.cycle_view}
                moduleViewDisabled={!currentProjectDetails?.module_view}
              />
            </FiltersDropdown>
          </>
        ) : (
          <></>
        )}
        {canUserCreateIssue ? (
          <Button
            onClick={() => {
              setTrackElement("PROJECT_VIEW_PAGE_HEADER");
              toggleCreateIssueModal(true, EIssuesStoreType.PROJECT_VIEW);
            }}
            size="sm"
          >
            Add work item
          </Button>
        ) : (
          <></>
        )}
        <div className="hidden md:block">
          <ViewQuickActions
            parentRef={parentRef}
            customClassName="flex-shrink-0 flex items-center justify-center size-[26px] bg-custom-background-80/70 rounded"
            projectId={projectId.toString()}
            view={viewDetails}
            workspaceSlug={workspaceSlug.toString()}
          />
        </div>
      </Header.RightItem>
    </Header>
  );
});
