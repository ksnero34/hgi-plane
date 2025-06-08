import { FC, useState } from "react";
import { observer } from "mobx-react";
import { useParams, useRouter } from "next/navigation";
import { Folder } from "lucide-react";
// types
import { TPageNavigationTabs } from "@plane/types";
// ui
import { setToast, TOAST_TYPE } from "@plane/ui";
// components
import { ListLayout } from "@/components/core/list";
import { ListItem } from "@/components/core/list";
// plane web hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";
// components
import { PageListBlock } from "./";

type TPagesListRoot = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
  folderId?: string | null;
};

export const PagesListRoot: FC<TPagesListRoot> = observer((props) => {
  const { pageType, storeType, folderId } = props;
  // states
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  // router
  const router = useRouter();
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getCurrentProjectFilteredPageIdsByTab, getPageById } = usePageStore(storeType);
  // derived values
  const filteredPageIds = getCurrentProjectFilteredPageIdsByTab(pageType, folderId);

  // 상위 폴더로 이동하는 함수
  const getParentFolderUrl = () => {
    if (!folderId) return `/${workspaceSlug}/projects/${projectId}/pages/`;
    
    const currentFolder = getPageById(folderId);
    const parentFolderId = currentFolder?.parent;
    
    if (parentFolderId) {
      return `/${workspaceSlug}/projects/${projectId}/pages/?folder=${parentFolderId}`;
    } else {
      return `/${workspaceSlug}/projects/${projectId}/pages/`;
    }
  };

  // 루트 영역에 드래그 오버 핸들러
  const handleRootDragOver = (e: React.DragEvent) => {
    // 자식 요소에서 이미 처리된 경우 무시
    if (e.target !== e.currentTarget) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOverRoot(true);
  };

  // 루트 영역에서 드래그 리브 핸들러
  const handleRootDragLeave = (e: React.DragEvent) => {
    // 자식 요소로 이동하는 경우가 아닐 때만 상태 변경
    if (e.target !== e.currentTarget) return;
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    
    setIsDragOverRoot(false);
  };

  // 루트 영역에 드롭 핸들러
  const handleRootDrop = async (e: React.DragEvent) => {
    // 자식 요소에서 이미 처리된 경우 무시
    if (e.target !== e.currentTarget) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
    
    const draggedPageId = e.dataTransfer.getData('text/plain');
    if (!draggedPageId) return;
    
    try {
      const draggedPage = getPageById(draggedPageId);
      if (!draggedPage) {
        throw new Error("드래그된 페이지를 찾을 수 없습니다.");
      }
      
      await draggedPage.moveToFolder(folderId || null);
      const targetName = folderId ? getPageById(folderId)?.name || "폴더" : "루트";
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공!",
        message: `"${draggedPage.name || "Untitled"}"이(가) ${targetName}로 이동되었습니다.`,
      });
    } catch (error) {
      console.error("페이지 이동 오류:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류가 발생했습니다!",
        message: error instanceof Error ? error.message : "페이지를 이동할 수 없습니다. 다시 시도해주세요.",
      });
    }
  };

  if (!filteredPageIds) return <></>;
  
  return (
    <div
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
      className={`min-h-[200px] ${isDragOverRoot ? 'bg-custom-primary-100/5 border-custom-primary-300 border-dashed border-2 rounded-lg' : ''}`}
    >
      <ListLayout>
        {/* 상위 디렉토리 이동 항목 (루트가 아닐 때만 표시) */}
        {folderId && (
          <ListItem
            prependTitleElement={<Folder className="h-4 w-4 text-custom-text-300" />}
            title=".."
            itemLink={getParentFolderUrl()}
            actionableItems={<></>}
            isMobile={false}
            parentRef={null}
          />
        )}
        
        {filteredPageIds.map((pageId) => (
          <PageListBlock key={pageId} pageId={pageId} storeType={storeType} />
        ))}
      </ListLayout>
    </div>
  );
});
