"use client";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { FileText, Folder } from "lucide-react";
// types
import { ICustomSearchSelectOption } from "@plane/types";
// ui
import { Breadcrumbs, Header, CustomSearchSelect } from "@plane/ui";
// components
import { BreadcrumbLink, PageAccessIcon, SwitcherLabel } from "@/components/common";
import { PageHeaderActions } from "@/components/pages/header/actions";
// helpers
import { getPageName } from "@/helpers/page.helper";
// hooks
import { useProject } from "@/hooks/store";
// plane web components
import { useAppRouter } from "@/hooks/use-app-router";
import { ProjectBreadcrumb } from "@/plane-web/components/breadcrumbs";
import { PageDetailsHeaderExtraActions } from "@/plane-web/components/pages";
// plane web hooks
import { EPageStoreType, usePage, usePageStore } from "@/plane-web/hooks/store";

export interface IPagesHeaderProps {
  showButton?: boolean;
}

const storeType = EPageStoreType.PROJECT;

export const PageDetailsHeader = observer(() => {
  // router
  const router = useAppRouter();
  const { workspaceSlug, pageId, projectId } = useParams();
  // store hooks
  const { currentProjectDetails, loader } = useProject();
  const { getPageById, getCurrentProjectPageIds } = usePageStore(storeType);
  const page = usePage({
    pageId: pageId?.toString() ?? "",
    storeType,
  });
  
  // 페이지의 부모 경로 생성
  const getPagePath = (pageId: string): string[] => {
    const path = [];
    let current = getPageById(pageId);
    while (current) {
      path.unshift(current.name || "Untitled");
      current = current.parent ? getPageById(current.parent) : null;
    }
    return path;
  };

  // 현재 페이지의 부모 폴더 경로
  const getCurrentPageFolderPath = () => {
    if (!page?.parent) return [];
    const path = [];
    let current = getPageById(page.parent);
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

  // derived values
  const projectPageIds = getCurrentProjectPageIds(projectId?.toString());
  const currentPageFolderPath = getCurrentPageFolderPath();

  const switcherOptions = projectPageIds
    .map((id) => {
      const _page = id === pageId ? page : getPageById(id);
      if (!_page) return;
      
      // 페이지의 전체 경로 생성
      const pagePath = getPagePath(id);
      const displayName = pagePath.length > 1 ? pagePath.join(" / ") : (getPageName(_page.name) || "Untitled");
      
      return {
        value: _page.id,
        query: displayName,
        content: (
          <div className="flex gap-2 items-center justify-between">
            <SwitcherLabel 
              logo_props={_page.logo_props} 
              name={displayName}
              LabelIcon={_page.is_folder ? Folder : FileText} 
            />
            {!_page.is_folder && <PageAccessIcon {..._page} />}
          </div>
        ),
      };
    })
    .filter((option) => option !== undefined) as ICustomSearchSelectOption[];

  if (!page) return null;

  return (
    <Header>
      <Header.LeftItem>
        <div>
          <Breadcrumbs isLoading={loader === "init-loader"}>
            <Breadcrumbs.BreadcrumbItem
              type="text"
              link={
                <span>
                  <span className="hidden md:block">
                    <ProjectBreadcrumb />
                  </span>
                  <span className="md:hidden">
                    <BreadcrumbLink
                      href={`/${workspaceSlug}/projects/${currentProjectDetails?.id}/issues`}
                      label={"..."}
                    />
                  </span>
                </span>
              }
            />

            <Breadcrumbs.BreadcrumbItem
              type="text"
              link={
                <BreadcrumbLink
                  href={getFolderUrl(null)}
                  label="Pages"
                  icon={<FileText className="h-4 w-4 text-custom-text-300" />}
                />
              }
            />
            
            {/* 현재 페이지의 부모 폴더 경로 브레드크럼 */}
            {currentPageFolderPath.map((folder, index) => (
              <Breadcrumbs.BreadcrumbItem
                key={folder.id}
                type="text"
                link={
                  <BreadcrumbLink
                    href={getFolderUrl(folder.id)}
                    label={folder.name || "Untitled"}
                    icon={<Folder className="h-4 w-4 text-custom-text-300" />}
                  />
                }
              />
            ))}
            
            <Breadcrumbs.BreadcrumbItem
              type="component"
              component={
                <CustomSearchSelect
                  value={pageId}
                  options={switcherOptions}
                  label={
                    <SwitcherLabel 
                      logo_props={page.logo_props} 
                      name={getPageName(page.name)} 
                      LabelIcon={page.is_folder ? Folder : FileText} 
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
          </Breadcrumbs>
        </div>
      </Header.LeftItem>
      <Header.RightItem>
        <PageDetailsHeaderExtraActions page={page} />
        <PageHeaderActions page={page} storeType={storeType} />
      </Header.RightItem>
    </Header>
  );
});
