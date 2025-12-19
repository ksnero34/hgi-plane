import { useEffect, useState } from "react";
import { observer } from "mobx-react";

import { useParams, useSearchParams } from "react-router";
import useSWR, { mutate } from "swr";
// icons
import { MoveLeft, MoveRight, RefreshCw } from "lucide-react";
// plane imports
import { EXPORTERS_LIST, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/ui";
import { useTheme } from "next-themes";
// assets
import exportsDark from "@/app/assets/empty-state/workspace-settings/exports-dark.webp?url";
import exportsLight from "@/app/assets/empty-state/workspace-settings/exports-light.webp?url";
// components
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { Exporter } from "@/components/exporter/export-modal";
import { SingleExport } from "@/components/exporter/single-export";
import { ImportExportSettingsLoader } from "@/components/ui/loader/settings/import-and-export";
// constants
import { EXPORT_SERVICES_LIST } from "@/constants/fetch-keys";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// services images
import CSVLogo from "@/app/assets/services/csv.svg";
import ExcelLogo from "@/app/assets/services/excel.svg";
import JSONLogo from "@/app/assets/services/json.svg";
// services
import { IntegrationService } from "@/services/integrations";

const integrationService = new IntegrationService();

const getExporterLogo = (provider: string) => {
  switch (provider) {
    case "csv":
      return CSVLogo;
    case "excel":
      return ExcelLogo;
    case "xlsx":
      return ExcelLogo;
    case "json":
      return JSONLogo;
    default:
      return "";
  }
};

export const ProjectExports = observer(() => {
  // states
  const [refreshing, setRefreshing] = useState(false);
  const per_page = 10;
  const [cursor, setCursor] = useState<string | undefined>(`10:0:0`);
  // router
  // router
  // const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const provider = searchParams.get("provider");
  // plane hooks
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  // store hooks
  const { data: currentUser, canPerformAnyCreateAction } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { workspaceProjectIds } = useProject();
  // derived values
  const resolvedPath = resolvedTheme === "dark" ? exportsDark : exportsLight;

  const { data: exporterServices } = useSWR(
    workspaceSlug && cursor ? EXPORT_SERVICES_LIST(workspaceSlug as string, cursor, `${per_page}`) : null,
    workspaceSlug && cursor
      ? () => integrationService.getExportsServicesList(workspaceSlug as string, cursor, per_page)
      : null
  );

  const handleRefresh = () => {
    setRefreshing(true);
    mutate(EXPORT_SERVICES_LIST(workspaceSlug as string, `${cursor}`, `${per_page}`)).then(() => setRefreshing(false));
  };

  const handleCsvClose = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("provider");
    setSearchParams(newParams, { replace: true });
  };

  const hasProjects = workspaceProjectIds && workspaceProjectIds.length > 0;
  const canExport = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  useEffect(() => {
    const interval = setInterval(() => {
      if (exporterServices?.results?.some((service) => service.status === "processing")) {
        handleRefresh();
      } else {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [exporterServices]);

  // 현재 프로젝트의 export만 필터링
  const filteredExports = exporterServices?.results?.filter(
    (service) => Array.isArray(service.project) && service.project.includes(projectId as string)
  );

  return (
    <>
      <div className="h-full w-full">
        <div className="flex items-center border-b border-custom-border-100 pb-3.5">
          <h3 className="text-xl font-medium">{t("workspace_settings.settings.exports.title")}</h3>
        </div>
        <>
          <div>
            {EXPORTERS_LIST.map((service) => (
              <div
                key={service.provider}
                className="flex items-center justify-between gap-2 border-b border-custom-border-100 bg-custom-background-100 py-6"
              >
                <div className="flex w-full items-start justify-between gap-4">
                  <div className="item-center flex gap-2.5">
                    <div className="relative h-10 w-10 flex-shrink-0">
                      <img src={getExporterLogo(service?.provider)} alt={`${t(service.i18n_title)} Logo`} />
                    </div>
                    <div>
                      <h3 className="flex items-center gap-4 text-sm font-medium">{t(service.i18n_title)}</h3>
                      <p className="text-sm tracking-tight text-custom-text-200">{t(service.i18n_description)}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="primary"
                      className="capitalize"
                      disabled={!canExport}
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set("provider", service.provider);
                        setSearchParams(newParams);
                      }}
                    >
                      {t(service.type)}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between border-b border-custom-border-100 pb-3.5 pt-7">
              <div className="flex items-center gap-2">
                <h3 className="flex gap-2 text-xl font-medium">
                  {t("workspace_settings.settings.exports.previous_exports")}
                </h3>

                <button
                  type="button"
                  className="flex flex-shrink-0 items-center gap-1 rounded bg-custom-background-80 px-1.5 py-1 text-xs outline-none"
                  onClick={handleRefresh}
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />{" "}
                  {refreshing ? `${t("refreshing")}...` : t("refresh_status")}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  disabled={!exporterServices?.prev_page_results}
                  onClick={() => exporterServices?.prev_page_results && setCursor(exporterServices?.prev_cursor)}
                  className={`flex items-center rounded border border-custom-primary-100 px-1 text-custom-primary-100 ${
                    exporterServices?.prev_page_results
                      ? "cursor-pointer hover:bg-custom-primary-100 hover:text-white"
                      : "cursor-not-allowed opacity-75"
                  }`}
                >
                  <MoveLeft className="h-4 w-4" />
                  <div className="pr-1">{t("prev")}</div>
                </button>
                <button
                  disabled={!exporterServices?.next_page_results}
                  onClick={() => exporterServices?.next_page_results && setCursor(exporterServices?.next_cursor)}
                  className={`flex items-center rounded border border-custom-primary-100 px-1 text-custom-primary-100 ${
                    exporterServices?.next_page_results
                      ? "cursor-pointer hover:bg-custom-primary-100 hover:text-white"
                      : "cursor-not-allowed opacity-75"
                  }`}
                >
                  <div className="pl-1">{t("next")}</div>
                  <MoveRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-col">
              {exporterServices && exporterServices?.results ? (
                filteredExports && filteredExports?.length > 0 ? (
                  <div>
                    <div className="divide-y divide-custom-border-200">
                      {filteredExports.map((service) => (
                        <SingleExport key={service.id} service={service} refreshing={refreshing} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <DetailedEmptyState
                      title={t("workspace_settings.empty_state.exports.title")}
                      description={t("workspace_settings.empty_state.exports.description")}
                      assetPath={resolvedPath}
                    />
                  </div>
                )
              ) : (
                <ImportExportSettingsLoader />
              )}
            </div>
          </div>
        </>
        {provider && (
          <Exporter
            isOpen
            handleClose={() => handleCsvClose()}
            data={null}
            user={currentUser || null}
            provider={provider}
            projectId={projectId as string}
            mutateServices={() => mutate(EXPORT_SERVICES_LIST(workspaceSlug as string, `${cursor}`, `${per_page}`))}
          />
        )}
      </div>
    </>
  );
});
