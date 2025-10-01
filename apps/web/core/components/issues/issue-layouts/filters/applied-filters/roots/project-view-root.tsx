"use client";

import { useState } from "react";
import cloneDeep from "lodash/cloneDeep";
import isEmpty from "lodash/isEmpty";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// types
import {
  EIssueFilterType,
  EUserPermissions,
  EUserPermissionsLevel,
  PROJECT_VIEW_TRACKER_ELEMENTS,
} from "@plane/constants";
import { EIssuesStoreType, EViewAccess, IIssueFilterOptions } from "@plane/types";
// components
import { Header, EHeaderVariant } from "@plane/ui";
import { CreateUpdateProjectViewModal } from "@/components/views/modal";
import { UpdateViewComponent } from "@/components/views/update-view-component";
// constants
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectView } from "@/hooks/store/use-project-view";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useCustomField } from "@/hooks/store/use-custom-field";
import { getAreFiltersEqual } from "../../../utils";
import { AppliedFiltersList } from "../filters-list";
import { calculateFilterValue , calculateFilterRemovalValue } from "@plane/utils";

export const ProjectViewAppliedFiltersRoot: React.FC = observer(() => {
  // router
  const { workspaceSlug, projectId, viewId } = useParams();
  // store hooks
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(EIssuesStoreType.PROJECT_VIEW);
  const { projectLabels } = useLabel();
  const { projectStates } = useProjectState();
  const { viewMap, updateView } = useProjectView();
  const { data } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { customFields } = useCustomField();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // derived values
  const viewDetails = viewId ? viewMap[viewId.toString()] : null;
  const userFilters = issueFilters?.filters;
  // filters whose value not null or empty array
  let appliedFilters: IIssueFilterOptions | undefined = undefined;
  Object.entries(userFilters ?? {}).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (!appliedFilters) appliedFilters = {};
    appliedFilters[key as keyof IIssueFilterOptions] = value;
  });

  const handleRemoveFilter = (key: keyof IIssueFilterOptions, value: string | null) => {
    if (!workspaceSlug || !projectId || !viewId) return;

    if (!value) {
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.FILTERS,
        { [key]: null },
        viewId.toString()
      );
      return;
    }

    // calculateFilterRemovalValue 함수를 사용하여 모든 필터를 통일된 방식으로 처리
    const updatedValue = calculateFilterRemovalValue(key, value, issueFilters?.filters ?? {});
    updateFilters(
      workspaceSlug.toString(),
      projectId.toString(),
      EIssueFilterType.FILTERS,
      { [key]: updatedValue },
      viewId.toString()
    );
  };

  const handleClearAllFilters = () => {
    if (!workspaceSlug || !projectId || !viewId) return;
    const newFilters: IIssueFilterOptions = {};
    Object.keys(userFilters ?? {}).forEach((key) => {
      // calculateFilterRemovalValue로 null 처리를 통일
      const clearedValue = calculateFilterRemovalValue(key as keyof IIssueFilterOptions, null, userFilters ?? {});
      (newFilters as any)[key] = clearedValue;
    });
    updateFilters(
      workspaceSlug.toString(),
      projectId.toString(),
      EIssueFilterType.FILTERS,
      { ...newFilters },
      viewId.toString()
    );
  };

  // add a placeholder object instead of appliedFilters if it is undefined
  const areFiltersEqual = getAreFiltersEqual(appliedFilters ?? {}, issueFilters, viewDetails);
  const viewFilters = {
    filters: cloneDeep(appliedFilters ?? {}),
    display_filters: cloneDeep(issueFilters?.displayFilters),
    display_properties: cloneDeep(issueFilters?.displayProperties),
  };
  // return if no filters are applied
  if (isEmpty(appliedFilters) && areFiltersEqual) return null;

  const handleUpdateView = () => {
    if (!workspaceSlug || !projectId || !viewId || !viewDetails) return;

    updateView(workspaceSlug.toString(), projectId.toString(), viewId.toString(), viewFilters);
  };

  const isAuthorizedUser = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  const isLocked = !!viewDetails?.is_locked;
  const isOwner = viewDetails?.owned_by === data?.id;

  return (
    <Header variant={EHeaderVariant.TERNARY}>
      <CreateUpdateProjectViewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        workspaceSlug={workspaceSlug.toString()}
        projectId={projectId.toString()}
        preLoadedData={{
          name: `${viewDetails?.name} 2`,
          description: viewDetails?.description,
          logo_props: viewDetails?.logo_props,
          access: viewDetails?.access ?? EViewAccess.PUBLIC,
          ...viewFilters,
        }}
      />
      <Header.LeftItem className="w-[70%]">
        <AppliedFiltersList
          appliedFilters={appliedFilters ?? {}}
          handleClearAllFilters={handleClearAllFilters}
          handleRemoveFilter={handleRemoveFilter}
          labels={projectLabels ?? []}
          states={projectStates}
          customFields={customFields}
          disableEditing={isLocked}
          workspaceSlug={workspaceSlug?.toString()}
          projectId={projectId?.toString()}
        />
      </Header.LeftItem>
      <Header.RightItem>
        <UpdateViewComponent
          isLocked={isLocked}
          areFiltersEqual={!!areFiltersEqual}
          isOwner={isOwner}
          isAuthorizedUser={isAuthorizedUser}
          setIsModalOpen={setIsModalOpen}
          handleUpdateView={handleUpdateView}
          trackerElement={PROJECT_VIEW_TRACKER_ELEMENTS.HEADER_SAVE_VIEW_BUTTON}
        />
      </Header.RightItem>
    </Header>
  );
});
