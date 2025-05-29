import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
// types
import { EIssueFilterType, EIssuesStoreType, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { IIssueFilterOptions, TCustomField } from "@plane/types";
// ui
import { Header, EHeaderVariant } from "@plane/ui";
// components
import { AppliedFiltersList, SaveFilterView } from "@/components/issues";
// constants
// hooks
import { useLabel, useProjectState, useUserPermissions } from "@/hooks/store";
import { useIssues } from "@/hooks/store/use-issues";
// plane web constants

type TProjectAppliedFiltersRootProps = {
  storeType?: EIssuesStoreType.PROJECT | EIssuesStoreType.EPIC;
};

export const ProjectAppliedFiltersRoot: React.FC<TProjectAppliedFiltersRootProps> = observer((props) => {
  const { storeType = EIssuesStoreType.PROJECT } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // states
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(false);
  // store hooks
  const { projectLabels } = useLabel();
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(storeType);
  const { allowPermissions } = useUserPermissions();

  const { projectStates } = useProjectState();

  // 커스텀 필드 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!workspaceSlug || !projectId || isLoadingCustomFields) return;
      
      try {
        setIsLoadingCustomFields(true);
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`,
          {
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          setCustomFields(data);
        }
      } catch (error) {
        console.error("커스텀 필드 로드 중 오류:", error);
      } finally {
        setIsLoadingCustomFields(false);
      }
    };

    fetchCustomFields();
  }, [workspaceSlug, projectId]);

  // derived values
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );
  const userFilters = issueFilters?.filters;
  // filters whose value not null or empty array
  const appliedFilters: IIssueFilterOptions = {};
  Object.entries(userFilters ?? {}).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value) && value.length === 0) return;
    appliedFilters[key as keyof IIssueFilterOptions] = value;
  });

  const handleRemoveFilter = (key: keyof IIssueFilterOptions, value: string | null) => {
    if (!workspaceSlug || !projectId) return;
    if (!value) {
      updateFilters(workspaceSlug.toString(), projectId.toString(), EIssueFilterType.FILTERS, {
        [key]: null,
      });
      return;
    }

    let newValues = issueFilters?.filters?.[key] ?? [];
    newValues = newValues.filter((val) => val !== value);

    updateFilters(workspaceSlug.toString(), projectId.toString(), EIssueFilterType.FILTERS, {
      [key]: newValues,
    });
  };

  const handleClearAllFilters = () => {
    if (!workspaceSlug || !projectId) return;
    const newFilters: IIssueFilterOptions = {};
    Object.keys(userFilters ?? {}).forEach((key) => {
      newFilters[key as keyof IIssueFilterOptions] = [];
    });
    updateFilters(workspaceSlug.toString(), projectId.toString(), EIssueFilterType.FILTERS, { ...newFilters });
  };

  // return if no filters are applied
  if (Object.keys(appliedFilters).length === 0) return null;

  return (
    <Header variant={EHeaderVariant.TERNARY}>
      <Header.LeftItem>
        <AppliedFiltersList
          appliedFilters={appliedFilters}
          handleClearAllFilters={handleClearAllFilters}
          handleRemoveFilter={handleRemoveFilter}
          labels={projectLabels ?? []}
          states={projectStates}
          customFields={customFields}
          alwaysAllowEditing
          workspaceSlug={workspaceSlug?.toString()}
          projectId={projectId?.toString()}
        />
      </Header.LeftItem>
      <Header.RightItem>
        {isEditingAllowed && (
          <SaveFilterView
            workspaceSlug={workspaceSlug?.toString()}
            projectId={projectId?.toString()}
            filterParams={{
              filters: appliedFilters,
              display_filters: issueFilters?.displayFilters,
              display_properties: issueFilters?.displayProperties,
            }}
          />
        )}
      </Header.RightItem>
    </Header>
  );
});
