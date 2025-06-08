"use client";

import { FC, useRef, useState } from "react";
import { observer } from "mobx-react";
import { FileText, Folder } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
// ui
import { setToast, TOAST_TYPE } from "@plane/ui";
// components
import { Logo } from "@/components/common";
import { ListItem } from "@/components/core/list";
import { BlockItemAction } from "@/components/pages/list";
// helpers
import { getPageName } from "@/helpers/page.helper";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web hooks
import { EPageStoreType, usePage } from "@/plane-web/hooks/store";

type TPageListBlock = {
  pageId: string;
  storeType: EPageStoreType;
};

export const PageListBlock: FC<TPageListBlock> = observer((props) => {
  const { pageId, storeType } = props;
  // refs
  const parentRef = useRef(null);
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // states
  const [isDragOver, setIsDragOver] = useState(false);
  // router
  const router = useRouter();
  const { workspaceSlug, projectId } = useParams();
  // hooks
  const page = usePage({
    pageId,
    storeType,
  });
  const { isMobile } = usePlatformOS();
  
  // handle page check
  if (!page) return null;
  
  // derived values
  const { name, logo_props, getRedirectionLink, is_folder } = page;

  // 폴더인 경우 폴더 내부로 이동하는 링크 생성
  const getFolderLink = () => {
    if (is_folder) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('folder', pageId);
      return currentUrl.pathname + currentUrl.search;
    }
    return getRedirectionLink();
  };

  // 드래그 시작 핸들러
  const handleDragStart = (e: React.DragEvent) => {
    if (is_folder) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', pageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 드래그 오버 핸들러 (폴더에만 적용)
  const handleDragOver = (e: React.DragEvent) => {
    if (!is_folder) return;
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
    if (!is_folder) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  // 드래그 리브 핸들러
  const handleDragLeave = (e: React.DragEvent) => {
    if (!is_folder) return;
    e.preventDefault();
    e.stopPropagation();
    
    // 약간의 지연을 두어 마우스가 자식 요소로 이동하는 경우를 처리
    dragOverTimeoutRef.current = setTimeout(() => {
      setIsDragOver(false);
    }, 100);
  };

  // 드롭 핸들러 (폴더에만 적용)
  const handleDrop = async (e: React.DragEvent) => {
    if (!is_folder) return;
    e.preventDefault();
    e.stopPropagation();
    
    // 타임아웃 클리어
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
    }
    
    setIsDragOver(false);
    
    const draggedPageId = e.dataTransfer.getData('text/plain');
    if (!draggedPageId || draggedPageId === pageId) return; // 자기 자신에게 드롭하는 경우 무시
    
    try {
      // 드래그된 페이지를 현재 폴더로 이동
      const draggedPage = page.store.getPageById(draggedPageId);
      if (!draggedPage) {
        throw new Error("드래그된 페이지를 찾을 수 없습니다.");
      }
      
      // 순환 참조 방지 - 부모를 자식으로 이동하려는 경우
      let currentParent = page.parent;
      while (currentParent) {
        if (currentParent === draggedPageId) {
          throw new Error("폴더를 자신의 하위 폴더로 이동할 수 없습니다.");
        }
        const parentPage = page.store.getPageById(currentParent);
        currentParent = parentPage?.parent;
      }
      
      await draggedPage.moveToFolder(pageId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공!",
        message: `"${getPageName(draggedPage.name)}"이(가) "${getPageName(name)}" 폴더로 이동되었습니다.`,
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

  return (
    <div
      draggable={!is_folder} // 폴더는 드래그 불가, 페이지만 드래그 가능
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${isDragOver && is_folder ? 'bg-custom-primary-100/10 border-custom-primary-300 border-dashed border-2 rounded' : ''}`}
    >
      <ListItem
        prependTitleElement={
          <>
            {is_folder ? (
              <Folder className="h-4 w-4 text-custom-text-300" />
            ) : logo_props?.in_use ? (
              <Logo logo={logo_props} size={16} type="lucide" />
            ) : (
              <FileText className="h-4 w-4 text-custom-text-300" />
            )}
          </>
        }
        title={getPageName(name)}
        itemLink={getFolderLink()}
        actionableItems={<BlockItemAction page={page} parentRef={parentRef} storeType={storeType} />}
        isMobile={isMobile}
        parentRef={parentRef}
        disableLink={isDragOver && is_folder} // 드래그 오버 시 링크 비활성화
      />
    </div>
  );
});
