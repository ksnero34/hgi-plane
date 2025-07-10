import { FC, useState, useRef } from "react";
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
// helpers
import { getPageName } from "@plane/utils";
// plane web hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";
// components
import { PageListBlock } from "./";

type TPagesListRoot = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
  folderId?: string | null;
};

// 상위 폴더 이동 컴포넌트
const ParentFolderItem: FC<{
  folderId: string;
  getPageById: (id: string) => any;
  getParentFolderUrl: () => string;
}> = ({ folderId, getPageById, getParentFolderUrl }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // 현재 폴더의 부모 폴더 ID 계산
  const currentFolder = getPageById(folderId);
  const parentFolderId = currentFolder?.parent;

  // 드래그 오버 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    // 타임아웃 클리어
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
    }
    
    setIsDragOver(true);
  };

  // 드래그 엔터 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  // 드래그 리브 핸들러
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 약간의 지연을 두어 마우스가 자식 요소로 이동하는 경우를 처리
    dragOverTimeoutRef.current = setTimeout(() => {
      setIsDragOver(false);
    }, 100);
  };

  // 드롭 핸들러
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 타임아웃 클리어
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
    }
    
    setIsDragOver(false);
    
    const draggedPageId = e.dataTransfer.getData('text/plain');
    if (!draggedPageId) return;
    
    try {
      const draggedPage = getPageById(draggedPageId);
      if (!draggedPage) {
        throw new Error("드래그된 항목을 찾을 수 없습니다.");
      }
      
      // 상위 폴더로 이동 (parentFolderId가 null이면 루트로 이동)
      await draggedPage.moveToFolder(parentFolderId || null);
      
      const targetName = parentFolderId ? getPageById(parentFolderId)?.name || "폴더" : "루트";
      const itemType = draggedPage.is_folder ? "폴더" : "페이지";
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공!",
        message: `"${getPageName(draggedPage.name)}" ${itemType}이(가) ${targetName}로 이동되었습니다.`,
      });
    } catch (error) {
      console.error("항목 이동 오류:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류가 발생했습니다!",
        message: error instanceof Error ? error.message : "항목을 이동할 수 없습니다. 다시 시도해주세요.",
      });
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${isDragOver ? 'bg-custom-primary-100/10 border-custom-primary-300 border-dashed border-2 rounded' : ''}`}
    >
      <ListItem
        prependTitleElement={<Folder className="h-4 w-4 text-custom-text-300" />}
        title=".."
        itemLink={getParentFolderUrl()}
        actionableItems={<></>}
        isMobile={false}
        parentRef={parentRef}
        disableLink={isDragOver} // 드래그 오버 시 링크 비활성화
      />
    </div>
  );
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
        throw new Error("드래그된 항목을 찾을 수 없습니다.");
      }
      
      await draggedPage.moveToFolder(folderId || null);
      const targetName = folderId ? getPageById(folderId)?.name || "폴더" : "루트";
      const itemType = draggedPage.is_folder ? "폴더" : "페이지";
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공!",
        message: `"${draggedPage.name || "Untitled"}" ${itemType}이(가) ${targetName}로 이동되었습니다.`,
      });
    } catch (error) {
      console.error("항목 이동 오류:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류가 발생했습니다!",
        message: error instanceof Error ? error.message : "항목을 이동할 수 없습니다. 다시 시도해주세요.",
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
          <ParentFolderItem
            folderId={folderId}
            getPageById={getPageById}
            getParentFolderUrl={getParentFolderUrl}
          />
        )}
        
        {filteredPageIds.map((pageId) => (
          <PageListBlock key={pageId} pageId={pageId} storeType={storeType} />
        ))}
      </ListLayout>
    </div>
  );
});
