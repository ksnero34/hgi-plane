import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { FileText, Folder } from "lucide-react";
import { EProjectFeatureKey } from "@plane/constants";
import { PageIcon } from "@plane/propel/icons";
import type { ICustomSearchSelectOption } from "@plane/types";
// ui
import { Breadcrumbs, Header, BreadcrumbNavigationSearchDropdown, CustomSearchSelect } from "@plane/ui";
// components
import { getPageName } from "@plane/utils";
// components
import { PageAccessIcon } from "@/components/common/page-access-icon";
import { SwitcherIcon, SwitcherLabel } from "@/components/common/switcher-label";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { PageHeaderActions } from "@/components/pages/header/actions";
import { PageSyncingBadge } from "@/components/pages/header/syncing-badge";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";
import { PageDetailsHeaderExtraActions } from "@/plane-web/components/pages";
import { EPageStoreType, usePage, usePageStore } from "@/plane-web/hooks/store";

export interface IPagesHeaderProps {
  showButton?: boolean;
}

const storeType = EPageStoreType.PROJECT;

export const PageDetailsHeader = observer(function PageDetailsHeader() {
  // router
  const router = useAppRouter();
  const { workspaceSlug, pageId, projectId } = useParams();
  // store hooks
  const { loader, currentProjectDetails } = useProject();
  const { getPageById, getCurrentProjectPageIds, getCurrentProjectFilteredPageIdsByTab } = usePageStore(storeType);
  const page = usePage({
    pageId: pageId?.toString() ?? "",
    storeType,
  });

  // 현재 페이지의 부모 폴더 경로
  const getCurrentPageFolderPath = () => {
    if (!page?.parent) return [];
    const path: any[] = [];
    let current: any = getPageById(page.parent);
    while (current) {
      path.unshift(current);
      current = current.parent ? getPageById(current.parent) : null;
    }
    return path;
  };

  // 폴더로 이동하는 함수
  const getFolderUrl = (targetFolderId: string | null) => {
    if (targetFolderId) {
      return `/${workspaceSlug}/projects/${projectId}/pages/?folder=${targetFolderId}`;
    } else {
      return `/${workspaceSlug}/projects/${projectId}/pages/`;
    }
  };

  // 특정 폴더 레벨의 옵션들을 생성하는 함수
  const getFolderLevelOptions = (parentFolderId: string | null) => {
    const currentFolderPageIds = getCurrentProjectFilteredPageIdsByTab("public", parentFolderId) || [];
    const currentFolderPrivatePageIds = getCurrentProjectFilteredPageIdsByTab("private", parentFolderId) || [];
    const currentFolderArchivedPageIds = getCurrentProjectFilteredPageIdsByTab("archived", parentFolderId) || [];

    const allCurrentFolderPageIds = [
      ...currentFolderPageIds,
      ...currentFolderPrivatePageIds,
      ...currentFolderArchivedPageIds,
    ];

    return allCurrentFolderPageIds
      .map((id) => {
        const _page = getPageById(id);
        if (!_page) return;

        return {
          value: _page.id,
          query: getPageName(_page.name) || "Untitled",
          content: (
            <div className="flex gap-2 items-center justify-between">
              <SwitcherLabel
                logo_props={_page.logo_props}
                name={getPageName(_page.name) || "Untitled"}
                LabelIcon={_page.is_folder ? Folder : FileText}
              />
              {!_page.is_folder && <PageAccessIcon {..._page} />}
            </div>
          ),
        };
      })
      .filter((option) => option !== undefined) as ICustomSearchSelectOption[];
  };

  // derived values
  const currentPageFolderPath = getCurrentPageFolderPath();

  // 현재 페이지가 위치한 폴더의 페이지들만 가져오기
  const currentFolderId = page?.parent || null;
  const folderLevelOptions = getFolderLevelOptions(currentFolderId);

  // derived values
  const projectPageIds = getCurrentProjectPageIds(projectId?.toString());

  const switcherOptions =
    folderLevelOptions.length > 0
      ? folderLevelOptions
      : (projectPageIds
          .map((id) => {
            const _page = id === pageId ? page : getPageById(id);
            if (!_page) return;
            return {
              value: _page.id,
              query: _page.name,
              content: (
                <div className="flex gap-2 items-center justify-between">
                  <SwitcherLabel
                    logo_props={_page.logo_props}
                    name={getPageName(_page.name) || "Untitled"}
                    LabelIcon={_page.is_folder ? Folder : FileText}
                  />
                  {!_page.is_folder && <PageAccessIcon {..._page} />}
                </div>
              ),
            };
          })
          .filter((option) => option !== undefined) as ICustomSearchSelectOption[]);

  if (!page) return null;

  return (
    <Header>
      <Header.LeftItem>
        <div>
          <Breadcrumbs isLoading={loader === "init-loader"}>
            <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug?.toString()} projectId={projectId?.toString()} />

            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  href={getFolderUrl(null)}
                  label="Pages"
                  icon={<FileText className="h-4 w-4 text-custom-text-300" />}
                />
              }
            />

            {/* 현재 페이지의 부모 폴더 경로 브레드크럼 - 각 폴더를 드롭다운으로 */}
            {currentPageFolderPath.map((folder, index) => {
              // 현재 폴더의 부모 폴더 ID 계산
              const parentFolderId = index === 0 ? null : currentPageFolderPath[index - 1]?.id;
              const folderLevelOptions = getFolderLevelOptions(parentFolderId);

              return (
                <Breadcrumbs.Item
                  key={folder.id}
                  component={
                    <CustomSearchSelect
                      value={folder.id}
                      buttonClassName="py-0.5"
                      options={folderLevelOptions}
                      label={
                        <SwitcherLabel
                          logo_props={folder.logo_props}
                          name={getPageName(folder.name) || "Untitled"}
                          LabelIcon={Folder}
                        />
                      }
                      onChange={(value: string) => {
                        const selectedPage = getPageById(value);
                        if (selectedPage?.is_folder) {
                          // 디렉토리인 경우 디렉토리 내부로 이동
                          router.push(getFolderUrl(value));
                        } else {
                          // 페이지인 경우 페이지 편집 화면으로 이동
                          router.push(`/${workspaceSlug}/projects/${projectId}/pages/${value}`);
                        }
                      }}
                    />
                  }
                />
              );
            })}

            <Breadcrumbs.Item
              component={
                <BreadcrumbNavigationSearchDropdown
                  selectedItem={pageId?.toString() ?? ""}
                  navigationItems={switcherOptions}
                  onChange={(value: string) => {
                    const selectedPage = getPageById(value);
                    if (selectedPage?.is_folder) {
                      // 디렉토리인 경우 디렉토리 내부로 이동
                      router.push(getFolderUrl(value));
                    } else {
                      // 페이지인 경우 페이지 편집 화면으로 이동
                      router.push(`/${workspaceSlug}/projects/${projectId}/pages/${value}`);
                    }
                  }}
                  title={getPageName(page?.name)}
                  icon={
                    <Breadcrumbs.Icon>
                      <SwitcherIcon
                        logo_props={page.logo_props}
                        LabelIcon={page.is_folder ? Folder : FileText}
                        size={16}
                      />
                    </Breadcrumbs.Icon>
                  }
                  isLast
                />
              }
            />
          </Breadcrumbs>
        </div>
      </Header.LeftItem>
      <Header.RightItem>
        <PageSyncingBadge syncStatus={page.isSyncingWithServer} />
        <PageDetailsHeaderExtraActions page={page} storeType={storeType} />
        <PageHeaderActions page={page} storeType={storeType} />
      </Header.RightItem>
    </Header>
  );
});
