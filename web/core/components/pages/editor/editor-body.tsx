import { useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// document-editor
import {
  CollaborativeDocumentEditorWithRef,
  CollaborativeDocumentReadOnlyEditorWithRef,
  EditorReadOnlyRefApi,
  EditorRefApi,
  TAIMenuProps,
  TDisplayConfig,
  TRealtimeConfig,
  TServerHandler,
} from "@plane/editor";
// types
import { IUserLite, IFileSettings } from "@plane/types";
import { EFileAssetType } from "@plane/types/src/enums";
// components
import { Row } from "@plane/ui";
import { PageContentBrowser, PageContentLoader, PageEditorTitle } from "@/components/pages";
// helpers
import { cn, LIVE_BASE_PATH, LIVE_BASE_URL } from "@/helpers/common.helper";
import { getEditorFileHandlers, getReadOnlyEditorFileHandlers } from "@/helpers/editor.helper";
import { getEditorFileUploadHandler } from "@/helpers/editor.file-handler";
import { generateRandomColor } from "@/helpers/string.helper";
import { maskPrivateInformation } from "@/utils/privacy-masking";
// hooks
import { useMember, useMention, useUser, useWorkspace, useInstance } from "@/hooks/store";
import { usePageFilters } from "@/hooks/use-page-filters";
import { TOAST_TYPE, setToast } from "@plane/ui";
import { MAX_FILE_SIZE } from "@/constants/common";
// plane web components
import { EditorAIMenu } from "@/plane-web/components/pages";
// plane web hooks
import { useEditorFlagging } from "@/plane-web/hooks/use-editor-flagging";
import { useFileSize } from "@/plane-web/hooks/use-file-size";
import { useIssueEmbed } from "@/plane-web/hooks/use-issue-embed";
// services
import { FileService } from "@/services/file.service";
// store
import { IPage } from "@/store/pages/page";

// services init
const fileService = new FileService();

type Props = {
  editorRef: React.RefObject<EditorRefApi>;
  editorReady: boolean;
  handleConnectionStatus: (status: boolean) => void;
  handleEditorReady: (value: boolean) => void;
  handleReadOnlyEditorReady: (value: boolean) => void;
  page: IPage;
  readOnlyEditorRef: React.RefObject<EditorReadOnlyRefApi>;
  sidePeekVisible: boolean;
};

export const PageEditorBody: React.FC<Props> = observer((props) => {
  const {
    editorRef,
    handleConnectionStatus,
    handleEditorReady,
    handleReadOnlyEditorReady,
    page,
    readOnlyEditorRef,
    sidePeekVisible,
  } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { data: currentUser } = useUser();
  const { getWorkspaceBySlug } = useWorkspace();
  const {
    getUserDetails,
    project: { getProjectMemberIds },
  } = useMember();
  const { instance } = useInstance();
  // derived values
  const workspaceId = workspaceSlug ? (getWorkspaceBySlug(workspaceSlug.toString())?.id ?? "") : "";
  const pageId = page?.id;
  const pageTitle = page?.name ?? "";
  const { isContentEditable, updateTitle } = page;
  const projectMemberIds = projectId ? getProjectMemberIds(projectId.toString()) : [];
  const projectMemberDetails = projectMemberIds?.map((id) => getUserDetails(id) as IUserLite);
  // use-mention
  const { mentionHighlights, mentionSuggestions } = useMention({
    workspaceSlug: workspaceSlug?.toString() ?? "",
    projectId: projectId?.toString() ?? "",
    members: projectMemberDetails,
    user: currentUser ?? undefined,
  });
  // editor flaggings
  const { documentEditor: disabledExtensions } = useEditorFlagging(workspaceSlug?.toString());
  // page filters
  const { fontSize, fontStyle, isFullWidth } = usePageFilters();
  // issue-embed
  const { issueEmbedProps } = useIssueEmbed(workspaceSlug?.toString() ?? "", projectId?.toString() ?? "");
  // file size
  const { maxFileSize } = useFileSize();

  const displayConfig: TDisplayConfig = {
    fontSize,
    fontStyle,
  };

  const getAIMenu = useCallback(
    ({ isOpen, onClose }: TAIMenuProps) => (
      <EditorAIMenu
        editorRef={editorRef}
        isOpen={isOpen}
        onClose={onClose}
        projectId={projectId?.toString() ?? ""}
        workspaceSlug={workspaceSlug?.toString() ?? ""}
      />
    ),
    [editorRef, projectId, workspaceSlug]
  );

  const handleServerConnect = useCallback(() => {
    handleConnectionStatus(false);
  }, []);

  const handleServerError = useCallback(() => {
    handleConnectionStatus(true);
  }, []);

  const serverHandler: TServerHandler = useMemo(
    () => ({
      onConnect: handleServerConnect,
      onServerError: handleServerError,
    }),
    [handleServerConnect, handleServerError]
  );

  const realtimeConfig: TRealtimeConfig | undefined = useMemo(() => {
    // Construct the WebSocket Collaboration URL
    try {
      const LIVE_SERVER_BASE_URL = LIVE_BASE_URL?.trim() || window.location.origin;
      const WS_LIVE_URL = new URL(LIVE_SERVER_BASE_URL);
      const isSecureEnvironment = window.location.protocol === "https:";
      WS_LIVE_URL.protocol = isSecureEnvironment ? "wss" : "ws";
      WS_LIVE_URL.pathname = `${LIVE_BASE_PATH}/collaboration`;
      // Construct realtime config
      return {
        url: WS_LIVE_URL.toString(),
        queryParams: {
          workspaceSlug: workspaceSlug?.toString(),
          projectId: projectId?.toString(),
          documentType: "project_page",
        },
      };
    } catch (error) {
      console.error("Error creating realtime config", error);
      return undefined;
    }
  }, [projectId, workspaceSlug]);

  const userConfig = useMemo(
    () => ({
      id: currentUser?.id ?? "",
      name: currentUser?.display_name ?? "",
      color: generateRandomColor(currentUser?.id ?? ""),
    }),
    [currentUser]
  );

  const validateFile = (file: File): boolean => {
    if (!instance?.fileSettings) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 설정을 불러올 수 없습니다",
        message: "파일 설정을 불러오는 중 오류가 발생했습니다."
      });
      return false;
    }

    const { max_file_size, allowed_extensions } = instance.fileSettings;

    if (!max_file_size || !allowed_extensions) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 설정이 올바르지 않습니다",
        message: "파일 설정이 올바르게 구성되지 않았습니다."
      });
      return false;
    }

    if (file.size > max_file_size) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 크기 초과",
        message: `파일 크기는 ${max_file_size / (1024 * 1024)}MB를 초과할 수 없습니다.`
      });
      return false;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowed_extensions.includes(fileExtension)) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "지원하지 않는 파일 형식",
        message: `지원되는 파일 형식: ${allowed_extensions.join(', ')}`
      });
      return false;
    }

    return true;
  };

  if (pageId === undefined || !realtimeConfig) return <PageContentLoader />;

  return (
    <div className="flex items-center h-full w-full overflow-y-auto">
      <Row
        className={cn("sticky top-0 hidden h-full flex-shrink-0 -translate-x-full py-5 duration-200 md:block", {
          "translate-x-0": sidePeekVisible,
          "w-[10rem] lg:w-[14rem]": !isFullWidth,
          "w-[5%]": isFullWidth,
        })}
      >
        {!isFullWidth && (
          <PageContentBrowser editorRef={(isContentEditable ? editorRef : readOnlyEditorRef)?.current} />
        )}
      </Row>
      <div
        className={cn("h-full w-full pt-5 duration-200", {
          "md:w-[calc(100%-10rem)] xl:w-[calc(100%-28rem)]": !isFullWidth,
          "md:w-[90%]": isFullWidth,
        })}
      >
        <div className="h-full w-full flex flex-col gap-y-7 overflow-y-auto overflow-x-hidden">
          <div className="relative w-full flex-shrink-0 md:pl-5 px-4">
            <PageEditorTitle
              editorRef={editorRef}
              title={pageTitle}
              updateTitle={updateTitle}
              readOnly={!isContentEditable}
            />
          </div>
          {isContentEditable ? (
            <CollaborativeDocumentEditorWithRef
              id={pageId}
              fileHandler={getEditorFileUploadHandler({
                maxFileSize: instance.fileSettings?.max_file_size ?? MAX_FILE_SIZE,
                projectId: projectId?.toString() ?? "",
                uploadFile: async (file) => {
                  const { asset_id } = await fileService.uploadProjectAsset(
                    workspaceSlug?.toString() ?? "",
                    projectId?.toString() ?? "",
                    {
                      entity_identifier: pageId,
                      entity_type: EFileAssetType.PAGE_DESCRIPTION,
                    },
                    file
                  );
                  return asset_id;
                },
                workspaceId,
                workspaceSlug: workspaceSlug?.toString() ?? "",
                allowedExtensions: instance.fileSettings?.allowed_extensions ?? ["pdf", "doc", "docx", "xls", "xlsx", "txt", "csv", "zip", "rar"],
              })}
              dragDropEnabled={true}
              handleEditorReady={handleEditorReady}
              ref={editorRef}
              containerClassName="h-full p-0 pb-64"
              displayConfig={displayConfig}
              editorClassName="pl-10"
              mentionHandler={{
                highlights: mentionHighlights,
                suggestions: mentionSuggestions,
              }}
              embedHandler={{
                issue: issueEmbedProps,
              }}
              realtimeConfig={realtimeConfig}
              serverHandler={serverHandler}
              user={userConfig}
              disabledExtensions={disabledExtensions}
              aiHandler={{
                menu: getAIMenu,
              }}
              transformContent={(content: string) => maskPrivateInformation(content)}
            />
          ) : (
            <CollaborativeDocumentReadOnlyEditorWithRef
              id={pageId}
              ref={readOnlyEditorRef}
              disabledExtensions={disabledExtensions}
              fileHandler={getReadOnlyEditorFileHandlers({
                projectId: projectId?.toString() ?? "",
                workspaceSlug: workspaceSlug?.toString() ?? "",
              })}
              handleEditorReady={handleReadOnlyEditorReady}
              containerClassName="p-0 pb-64 border-none"
              displayConfig={displayConfig}
              editorClassName="pl-10"
              mentionHandler={{
                highlights: mentionHighlights,
              }}
              embedHandler={{
                issue: {
                  widgetCallback: issueEmbedProps.widgetCallback,
                },
              }}
              realtimeConfig={realtimeConfig}
              user={userConfig}
              transformContent={(content: string) => maskPrivateInformation(content)}
            />
          )}
        </div>
      </div>
      <div
        className={cn("hidden xl:block flex-shrink-0 duration-200", {
          "w-[10rem] lg:w-[14rem]": !isFullWidth,
          "w-[5%]": isFullWidth,
        })}
      />
    </div>
  );
});
