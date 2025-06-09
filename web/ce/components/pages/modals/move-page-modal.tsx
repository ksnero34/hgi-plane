// store types
import { useState } from "react";
import { observer } from "mobx-react";
import { Folder } from "lucide-react";
import { Button, CustomSearchSelect, ModalCore } from "@plane/ui";
import type { ICustomSearchSelectOption } from "@plane/types";
// hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";
// store types
import { TPageInstance } from "@/store/pages/base-page";

export type TMovePageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  page: TPageInstance;
};

// 폴더 계층 구조를 생성하는 헬퍼 함수
const buildFolderHierarchy = (folders: any[], getPageById: (id: string) => any, excludeId?: string) => {
  const folderMap = new Map();
  const rootFolders: any[] = [];
  
  // 제외할 폴더와 그 하위 폴더들을 필터링
  const filteredFolders = folders.filter(folder => {
    if (folder.id === excludeId) return false;
    
    // 제외할 폴더의 하위 폴더인지 확인
    let current = folder;
    while (current.parent) {
      if (current.parent === excludeId) return false;
      current = getPageById(current.parent);
      if (!current) break;
    }
    return true;
  });
  
  // 폴더 맵 생성
  filteredFolders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });
  
  // 계층 구조 구성
  filteredFolders.forEach(folder => {
    if (folder.parent && folderMap.has(folder.parent)) {
      folderMap.get(folder.parent).children.push(folderMap.get(folder.id));
    } else {
      rootFolders.push(folderMap.get(folder.id));
    }
  });
  
  // 계층 구조를 평면 리스트로 변환 (들여쓰기 포함)
  const flattenHierarchy = (folders: any[], depth = 0): ICustomSearchSelectOption[] => {
    const result: ICustomSearchSelectOption[] = [];
    
    folders.forEach(folder => {
      result.push({
        value: folder.id,
        query: folder.name || "",
        content: (
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
            <span className="text-custom-text-300">└</span>
            <Folder className="h-4 w-4 text-custom-text-300 flex-shrink-0" />
            <span className="truncate">{folder.name || "Untitled"}</span>
          </div>
        ),
      });
      
      if (folder.children.length > 0) {
        result.push(...flattenHierarchy(folder.children, depth + 1));
      }
    });
    
    return result;
  };
  
  return flattenHierarchy(rootFolders);
};

export const MovePageModal: React.FC<TMovePageModalProps> = observer((props) => {
  const { isOpen, onClose, page } = props;
  const { getFolderPages, getPageById } = usePageStore(EPageStoreType.PROJECT);
  const [selectedParent, setSelectedParent] = useState<string | null>(page.parent ?? null);

  if (!page) return null;

  // 디버깅을 위한 로그
  const folderPages = getFolderPages();
  // console.log('Folder pages:', folderPages);

  // 계층 구조로 폴더 옵션 생성
  const hierarchicalFolders = buildFolderHierarchy(folderPages, getPageById, page.id);
  // console.log('Hierarchical folders:', hierarchicalFolders);
  
  const folderOptions: ICustomSearchSelectOption[] = [
    { 
      value: null, 
      query: "root", 
      content: (
        <div className="flex items-center gap-1">
          <Folder className="h-4 w-4 text-custom-text-300 flex-shrink-0" />
          <span>Root</span>
        </div>
      )
    },
    ...hierarchicalFolders
  ];

  // 선택된 폴더의 표시명 가져오기
  const getSelectedFolderLabel = () => {
    if (!selectedParent) {
      return (
        <div className="flex items-center gap-1">
          <Folder className="h-4 w-4 text-custom-text-300 flex-shrink-0" />
          <span>Root</span>
        </div>
      );
    }
    const selectedFolder = getFolderPages().find(f => f.id === selectedParent);
    return (
      <div className="flex items-center gap-1">
        <Folder className="h-4 w-4 text-custom-text-300 flex-shrink-0" />
        <span>{selectedFolder?.name || "Untitled"}</span>
      </div>
    );
  };

  const handleMove = async () => {
    await page.moveToFolder(selectedParent);
    onClose();
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose}>
      <div className="space-y-5 p-5">
        <h3 className="text-xl font-medium text-custom-text-200">Move Page</h3>
        <CustomSearchSelect
          value={selectedParent}
          onChange={(val: string | null) => setSelectedParent(val)}
          options={folderOptions}
          label={getSelectedFolderLabel()}
          optionsClassName="max-w-64"
          placement="bottom-end"
        />
      </div>
      <div className="px-5 py-4 flex items-center justify-end gap-2 border-t-[0.5px] border-custom-border-200">
        <Button variant="neutral-primary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleMove}>
          Move
        </Button>
      </div>
    </ModalCore>
  );
});
