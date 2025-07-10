"use client";

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FileText, Folder, ChevronRight } from "lucide-react";
// constants
import { EPageAccess, EProjectFeatureKey, PROJECT_TRACKER_ELEMENTS } from "@plane/constants";
// plane types
import { TPage } from "@plane/types";
// plane ui
import { Breadcrumbs, Button, Header, setToast, TOAST_TYPE } from "@plane/ui";
// helpers
import { BreadcrumbLink } from "@/components/common";
import { captureClick } from "@/helpers/event-tracker.helper";
// hooks
import { useProject, useCommandPalette } from "@/hooks/store";
// plane web
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs";
// plane web hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";

export const PagesListHeader = observer(() => {
  // states
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  // router
  const router = useRouter();
  const { workspaceSlug, projectId } = useParams();
  const searchParams = useSearchParams();
  const pageType = searchParams.get("type");
  const folderId = searchParams.get("folder");
  // store hooks
  const { currentProjectDetails, loader } = useProject();
  const { canCurrentUserCreatePage, createPage, getPageById } = usePageStore(EPageStoreType.PROJECT);
  const { toggleCreatePageModal } = useCommandPalette();

  // 현재 폴더 정보 가져오기
  const currentFolder = folderId ? getPageById(folderId) : null;

  // 폴더 경로 생성
  const getFolderPath = () => {
    const path: any[] = [];
    let current: any = currentFolder;
    while (current) {
      path.unshift(current);
      current = current.parent ? getPageById(current.parent) : null;
    }
    return path;
  };

  // 폴더로 이동하는 함수
  const getFolderUrl = (targetFolderId: string | null) => {
    const currentUrl = new URL(window.location.href);
    if (targetFolderId) {
      currentUrl.searchParams.set('folder', targetFolderId);
    } else {
      currentUrl.searchParams.delete('folder');
    }
    return currentUrl.pathname + currentUrl.search;
  };

  // handle page create
  const handleCreatePage = async () => {
    setIsCreatingPage(true);
    captureClick({ elementName: "Project pages page" });

    const payload: Partial<TPage> = {
      access: pageType === "private" ? EPageAccess.PRIVATE : EPageAccess.PUBLIC,
      parent: folderId || null, // 현재 폴더를 부모로 설정
    };

    await createPage(payload)
      .then((res) => {
        const pageId = `/${workspaceSlug}/projects/${currentProjectDetails?.id}/pages/${res?.id}`;
        router.push(pageId);
      })
      .catch((err) =>
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "오류가 발생했습니다!",
          message: "페이지를 생성할 수 없습니다. 다시 시도해주세요.",
        })
      )
      .finally(() => setIsCreatingPage(false));
  };

  const folderPath = getFolderPath();

  return (
    <Header>
      <Header.LeftItem>
        <div>
          <Breadcrumbs isLoading={loader === "init-loader"}>
            <CommonProjectBreadcrumbs
              workspaceSlug={workspaceSlug?.toString() ?? ""}
              projectId={projectId?.toString() ?? ""}
              featureKey={EProjectFeatureKey.PAGES}
            />
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  label="Pages"
                  icon={<FileText className="h-4 w-4 text-custom-text-300" />}
                  href={getFolderUrl(null)}
                />
              }
            />
            {/* 폴더 경로 브레드크럼 */}
            {folderPath.map((folder, index) => (
              <Breadcrumbs.Item
                key={folder.id}
                component={
                  <BreadcrumbLink
                    label={folder.name || "Untitled"}
                    icon={<Folder className="h-4 w-4 text-custom-text-300" />}
                    href={getFolderUrl(folder.id || null)}
                  />
                }
              />
            ))}
          </Breadcrumbs>
        </div>
      </Header.LeftItem>
      {canCurrentUserCreatePage ? (
        <Header.RightItem>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleCreatePage} 
            loading={isCreatingPage}
            data-ph-element={PROJECT_TRACKER_ELEMENTS.CREATE_HEADER_BUTTON}
          >
            {isCreatingPage ? "Adding" : "Add page"}
          </Button>
          <Button
            variant="neutral-primary"
            size="sm"
            onClick={() => toggleCreatePageModal({
              isOpen: true,
              isFolder: true,
              redirectionEnabled: true,
              parentFolderId: folderId || null
            })}
          >
            Add folder
          </Button>
        </Header.RightItem>
      ) : (
        <></>
      )}
    </Header>
  );
});
