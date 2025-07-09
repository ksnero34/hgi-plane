import { observer } from "mobx-react";
import useSWR from "swr";
import { TPageNavigationTabs } from "@plane/types";
// components
import { PagesListHeaderRoot, PagesListMainContent } from "@/components/pages";
// plane web hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";

type TPageView = {
  children: React.ReactNode;
  pageType: TPageNavigationTabs;
  projectId: string;
  storeType: EPageStoreType;
  workspaceSlug: string;
  folderId?: string | null;
};

export const PagesListView: React.FC<TPageView> = observer((props) => {
  const { children, pageType, projectId, storeType, workspaceSlug, folderId } = props;
  // store hooks
  const { isAnyPageAvailable, fetchPagesList } = usePageStore(storeType);
  // fetching pages list
  useSWR(
    workspaceSlug && projectId && pageType ? `PROJECT_PAGES_${projectId}_${folderId || 'root'}` : null,
    workspaceSlug && projectId && pageType ? () => fetchPagesList(workspaceSlug, projectId, pageType, folderId || undefined) : null
  );

  // pages loader
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col">
      {/* tab header */}
      {isAnyPageAvailable && (
        <PagesListHeaderRoot
          pageType={pageType}
          projectId={projectId}
          storeType={storeType}
          workspaceSlug={workspaceSlug}
          folderId={folderId}
        />
      )}
      <PagesListMainContent pageType={pageType} storeType={storeType} folderId={folderId}>
        {children}
      </PagesListMainContent>
    </div>
  );
});
