"use client";

import { useCallback, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// types
import { EUserPermissionsLevel, EUserProjectRoles } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TModuleFilters, TCustomField } from "@plane/types";
// components
import { PageHead } from "@/components/core";
import { DetailedEmptyState } from "@/components/empty-state";
import { ModuleAppliedFiltersList, ModulesListView } from "@/components/modules";
// helpers
import { cn } from "@/helpers/common.helper";
import { calculateFilterRemovalValue } from "@/helpers/filter-update.helper";
import { calculateTotalFilters } from "@/helpers/filter.helper";
// hooks
import { useModuleFilter, useProject, useUserPermissions } from "@/hooks/store";
import { useAppRouter } from "@/hooks/use-app-router";
import { useResolvedAssetPath } from "@/hooks/use-resolved-asset-path";

const ProjectModulesPage = observer(() => {
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  // plane hooks
  const { t } = useTranslation();
  // states
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  // store
  const { getProjectById, currentProjectDetails } = useProject();
  const { currentProjectFilters, currentProjectDisplayFilters, clearAllFilters, updateFilters, updateDisplayFilters } =
    useModuleFilter();
  const { allowPermissions } = useUserPermissions();
  // derived values
  const project = projectId ? getProjectById(projectId.toString()) : undefined;
  const pageTitle = project?.name ? `${project?.name} - Modules` : undefined;
  const canPerformEmptyStateActions = allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT);
  const resolvedPath = useResolvedAssetPath({ basePath: "/empty-state/disabled-feature/modules" });

  // 커스텀 필드 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!workspaceSlug || !projectId) return;

      try {
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
      }
    };

    fetchCustomFields();
  }, [workspaceSlug, projectId]);

  const handleRemoveFilter = useCallback(
    (key: keyof TModuleFilters, value: string | null) => {
      if (!projectId) return;

      if (!value) {
        updateFilters(projectId.toString(), { [key]: [] });
        return;
      }

      const updatedValue = calculateFilterRemovalValue<TModuleFilters>(key as string, value, currentProjectFilters ?? {});
      updateFilters(projectId.toString(), { [key]: updatedValue });
    },
    [projectId, currentProjectFilters, updateFilters]
  );

  if (!workspaceSlug || !projectId) return <></>;

  // No access to
  if (currentProjectDetails?.module_view === false)
    return (
      <div className="flex items-center justify-center h-full w-full">
        <DetailedEmptyState
          title={t("disabled_project.empty_state.module.title")}
          description={t("disabled_project.empty_state.module.description")}
          assetPath={resolvedPath}
          primaryButton={{
            text: t("disabled_project.empty_state.module.primary_button.text"),
            onClick: () => {
              router.push(`/${workspaceSlug}/projects/${projectId}/settings/features`);
            },
            disabled: !canPerformEmptyStateActions,
          }}
        />
      </div>
    );

  return (
    <>
      <PageHead title={pageTitle} />
      <div className="h-full w-full flex flex-col">
        {(calculateTotalFilters(currentProjectFilters ?? {}) !== 0 || currentProjectDisplayFilters?.favorites) && (
          <ModuleAppliedFiltersList
            appliedFilters={currentProjectFilters ?? {}}
            isFavoriteFilterApplied={currentProjectDisplayFilters?.favorites ?? false}
            handleClearAllFilters={() => clearAllFilters(`${projectId}`)}
            handleRemoveFilter={handleRemoveFilter}
            handleDisplayFiltersUpdate={(val) => {
              if (!projectId) return;
              updateDisplayFilters(projectId.toString(), val);
            }}
            alwaysAllowEditing
            workspaceSlug={workspaceSlug as string}
            projectId={projectId as string}
            customFields={customFields}
          />
        )}
        <ModulesListView />
      </div>
    </>
  );
});

export default ProjectModulesPage;
