"use client";

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
// editor
import { EditorReadOnlyRefApi, EditorRefApi } from "@plane/editor";
// types
import { TPage } from "@plane/types";
// ui
import { setToast, TOAST_TYPE } from "@plane/ui";
// components
import { 
  PageEditorHeaderRoot, 
  PageEditorBody, 
  PageVersionsOverlay, 
  PagesVersionEditor 
} from "@/components/pages";
import { PageVersionsSidebarRoot } from "@/components/pages/version/sidebar-root";
import { PageFilesSidebarRoot } from "@/components/pages/files/sidebar-root";
// hooks
import { useProjectPages } from "@/hooks/store";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePageFallback } from "@/hooks/use-page-fallback";
import { useQueryParams } from "@/hooks/use-query-params";
// services
import { ProjectPageService, ProjectPageVersionService } from "@/services/page";
const projectPageService = new ProjectPageService();
const projectPageVersionService = new ProjectPageVersionService();
// store
import { IPage } from "@/store/pages/page";

type TPageRootProps = {
  page: IPage;
  projectId: string;
  workspaceSlug: string;
};

export const PageRoot = observer((props: TPageRootProps) => {
  const { projectId, workspaceSlug, page } = props;
  // states
  const [editorReady, setEditorReady] = useState(false);
  const [hasConnectionFailed, setHasConnectionFailed] = useState(false);
  const [readOnlyEditorReady, setReadOnlyEditorReady] = useState(false);
  const [sidePeekVisible, setSidePeekVisible] = useState(window.innerWidth >= 768);
  const [isVersionsOverlayOpen, setIsVersionsOverlayOpen] = useState(false);
  const [isFilesSidebarOpen, setIsFilesSidebarOpen] = useState(true);
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  const readOnlyEditorRef = useRef<EditorReadOnlyRefApi>(null);
  // router
  const router = useAppRouter();
  // search params
  const searchParams = useSearchParams();
  // store hooks
  const { createPage } = useProjectPages();

  // page가 없으면 로딩 상태를 보여줌
  if (!page) {
    console.log("❌ PageRoot - page prop이 없음");
    return <PageContentLoader />;
  }

  // derived values
  const { access, description_html, name, isContentEditable, updateDescription } = page;
  // page fallback
  usePageFallback({
    editorRef,
    fetchPageDescription: async () => {
      if (!page.id) return;
      return await projectPageService.fetchDescriptionBinary(workspaceSlug, projectId, page.id);
    },
    hasConnectionFailed,
    updatePageDescription: async (data) => await updateDescription(data),
  });
  // update query params
  const { updateQueryParams } = useQueryParams();

  const handleCreatePage = async (payload: Partial<TPage>) => await createPage(payload);

  const handleDuplicatePage = async () => {
    const formData: Partial<TPage> = {
      name: "Copy of " + name,
      description_html: editorRef.current?.getDocument().html ?? description_html ?? "<p></p>",
      access,
    };

    await handleCreatePage(formData)
      .then((res) => router.push(`/${workspaceSlug}/projects/${projectId}/pages/${res?.id}`))
      .catch(() =>
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: "Page could not be duplicated. Please try again later.",
        })
      );
  };

  const version = searchParams.get("version");
  useEffect(() => {
    if (!version) {
      setIsVersionsOverlayOpen(false);
      return;
    }
    setIsVersionsOverlayOpen(true);
  }, [version]);

  const handleCloseVersionsOverlay = () => {
    const updatedRoute = updateQueryParams({
      paramsToRemove: ["version"],
    });
    router.push(updatedRoute);
  };

  const handleRestoreVersion = async (descriptionHTML: string) => {
    editorRef.current?.clearEditor();
    editorRef.current?.setEditorValue(descriptionHTML);
  };
  const currentVersionDescription = isContentEditable
    ? editorRef.current?.getDocument().html
    : readOnlyEditorRef.current?.getDocument().html;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <PageVersionsOverlay
        activeVersion={version}
        currentVersionDescription={currentVersionDescription ?? null}
        editorComponent={PagesVersionEditor}
        fetchAllVersions={async (pageId) => {
          if (!workspaceSlug || !projectId) return;
          return await projectPageVersionService.fetchAllVersions(
            workspaceSlug.toString(),
            projectId.toString(),
            pageId
          );
        }}
        fetchVersionDetails={async (pageId, versionId) => {
          if (!workspaceSlug || !projectId) return;
          return await projectPageVersionService.fetchVersionById(
            workspaceSlug.toString(),
            projectId.toString(),
            pageId,
            versionId
          );
        }}
        handleRestore={handleRestoreVersion}
        isOpen={isVersionsOverlayOpen}
        onClose={handleCloseVersionsOverlay}
        pageId={page.id ?? ""}
        restoreEnabled={isContentEditable}
      />
      <PageEditorHeaderRoot
        editorReady={editorReady}
        editorRef={editorRef}
        handleDuplicatePage={handleDuplicatePage}
        page={page}
        readOnlyEditorReady={readOnlyEditorReady}
        readOnlyEditorRef={readOnlyEditorRef}
        setSidePeekVisible={(state) => setSidePeekVisible(state)}
        sidePeekVisible={sidePeekVisible}
      />
      <div className="relative h-[calc(100%-3.75rem)] w-full">
        <div className="flex h-full w-full">
          <div className="flex-grow h-full pr-[280px]">
            <PageEditorBody
              editorReady={editorReady}
              editorRef={editorRef}
              handleConnectionStatus={(status) => setHasConnectionFailed(status)}
              handleEditorReady={(val) => setEditorReady(val)}
              handleReadOnlyEditorReady={() => setReadOnlyEditorReady(true)}
              page={page}
              readOnlyEditorRef={readOnlyEditorRef}
              sidePeekVisible={sidePeekVisible}
            />
          </div>

          {/* 오른쪽 사이드바 */}
          <div className="fixed right-0 top-[3.75rem] bottom-0 w-[280px] border-l border-custom-border-200">
            <div className="h-1/2 border-b border-custom-border-200">
              {isVersionsOverlayOpen && (
                <PageVersionsSidebarRoot
                  activeVersion={version}
                  fetchAllVersions={async (pageId) => {
                    if (!workspaceSlug || !projectId) return;
                    return await projectPageVersionService.fetchAllVersions(
                      workspaceSlug.toString(),
                      projectId.toString(),
                      pageId
                    );
                  }}
                  handleClose={() => setIsVersionsOverlayOpen(false)}
                  isOpen={isVersionsOverlayOpen}
                  pageId={page.id}
                />
              )}
            </div>
            <div className="h-1/2">
              <PageFilesSidebarRoot
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                pageId={page.id}
                handleClose={() => setIsFilesSidebarOpen(false)}
                isOpen={isFilesSidebarOpen}
                onFileUpload={() => setIsFilesSidebarOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
