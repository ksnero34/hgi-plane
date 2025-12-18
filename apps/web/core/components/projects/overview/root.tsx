import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
import { EUserPermissions, EUserPermissionsLevel, LIVE_BASE_PATH, LIVE_BASE_URL } from "@plane/constants";
import { CollaborativeDocumentEditorWithRef } from "@plane/editor";
import type { EditorRefApi, TRealtimeConfig, TServerHandler, TFileHandler } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { EFileAssetType } from "@plane/types";
import type {
  TLogoProps,
  TProjectOverviewSnapshot,
  TSearchEntityRequestPayload,
  TWebhookConnectionQueryParams,
} from "@plane/types";
import { EmojiPicker, EmojiIconPickerTypes } from "@plane/propel/emoji-icon-picker";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Loader, Spinner } from "@plane/ui";
import { getEmojiImageUrlFromDecimal, getFileURL, getTextContent, generateRandomColor, hslToHex } from "@plane/utils";
// plane web components
import { ImagePickerPopover } from "@/components/core/image-picker-popover";
import { PageHead } from "@/components/core/page-title";
import { EditorMentionsRoot } from "@/components/editor/embeds/mentions";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { Logo } from "@/components/common/logo";
// hooks
import { useEditorConfig, useEditorMention } from "@/hooks/editor";
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useWorkflow } from "@/hooks/store/use-workflow";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions, useUser } from "@/hooks/store/user";
// services
import { ProjectService } from "@/services/project";
import { WorkspaceService } from "@/services/workspace.service";
import { useEditorFlagging } from "@/plane-web/hooks/use-editor-flagging";
import { useExtendedEditorProps } from "@/plane-web/hooks/pages";
// local
import { DEFAULT_PROJECT_OVERVIEW_HTML } from "./constants";
import { ProjectOverviewProgress } from "./progress";

const projectService = new ProjectService();

type TCoverPickerForm = {
  search: string;
};

export const ProjectOverviewRoot = observer(() => {
  const { workspaceSlug, projectId } = useParams();
  const slug = workspaceSlug?.toString();
  const pid = projectId?.toString();
  // hooks
  const { t } = useTranslation();
  const { data: currentUser } = useUser();
  const { getProjectById, updateProject } = useProject();
  const { getWorkspaceBySlug } = useWorkspace();
  const { uploadEditorAsset } = useEditorAsset();
  const { allowPermissions } = useUserPermissions();
  const { getUserDetails } = useMember();
  const { getEditorFileHandlers } = useEditorConfig();
  const { getDefaultWorkflow, fetchWorkflowTransitions } = useWorkflow();
  const workspaceService = useMemo(() => new WorkspaceService(), []);
  const { control: coverPickerControl } = useForm<TCoverPickerForm>({
    defaultValues: { search: "" },
  });
  const editorRef = useRef<EditorRefApi>(null);

  const project = pid ? getProjectById(pid) : undefined;
  const workspaceId = slug ? (getWorkspaceBySlug(slug)?.id?.toString() ?? "") : "";
  const isAdmin =
    !!slug && !!pid && allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, slug, pid);

  const { data: overviewData, isLoading: isOverviewLoading } = useSWR<TProjectOverviewSnapshot>(
    slug && pid ? ["project-overview", slug, pid] : null,
    () => projectService.getProjectOverview(slug!, pid!),
    {
      revalidateOnFocus: false,
    }
  );

  const [isCoverUpdating, setIsCoverUpdating] = useState<boolean>(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState<boolean>(false);
  const [isLogoUpdating, setIsLogoUpdating] = useState<boolean>(false);
  const [hasConnectionFailed, setHasConnectionFailed] = useState<boolean>(false);
  const [editorReady, setEditorReady] = useState<boolean>(false);

  // Preload workflow transitions for peek overview
  useEffect(() => {
    if (!pid || !slug) return;

    const defaultWorkflow = getDefaultWorkflow(pid);
    if (!defaultWorkflow) return;

    // Fetch workflow transitions so they're available when peek overview opens
    fetchWorkflowTransitions(slug, pid, defaultWorkflow.id).catch((error) => {
      console.error("Failed to preload workflow transitions:", error);
    });
  }, [pid, slug, getDefaultWorkflow, fetchWorkflowTransitions]);

  const handleCoverChange = async (url: string) => {
    if (!slug || !pid) return;
    setIsCoverUpdating(true);
    try {
      await updateProject(slug, pid, {
        cover_image: url,
        cover_image_asset: null,
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("toast.success"),
        message: "Project cover updated.",
      });
    } catch (error) {
      console.error(error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: "Unable to update cover. Please try again.",
      });
    } finally {
      setIsCoverUpdating(false);
    }
  };

  const handleUpdateDescription = useCallback(
    async (descriptionHTML: string, descriptionJSON: object) => {
      if (!slug || !pid) return;
      try {
        const plainText = getTextContent(descriptionHTML || "");
        await updateProject(slug, pid, {
          overview: plainText,
          overview_html: descriptionHTML || "<p></p>",
          overview_text: plainText,
        });
      } catch (error) {
        console.error(error);
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("toast.error"),
          message: "Unable to save overview. Please try again.",
        });
      }
    },
    [slug, pid, updateProject, t]
  );

  const handleLogoChange = async (val: any) => {
    if (!slug || !pid) return;
    if (!val) {
      setIsEmojiPickerOpen(false);
      return;
    }

    let logoValue: Record<string, any> = {};
    if (val?.type === "emoji") {
      logoValue = {
        value: val.value.decimal,
        url: val.value.imageUrl || getEmojiImageUrlFromDecimal(val.value.decimal),
      };
    } else if (val?.type === "icon") {
      logoValue = val.value;
    }

    const payload = {
      in_use: val?.type,
      [val?.type]: logoValue,
    };

    setIsLogoUpdating(true);
    try {
      await updateProject(slug, pid, { logo_props: payload });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("toast.success"),
        message: t("project_settings.general.toast.success"),
      });
    } catch (error) {
      console.error(error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: t("something_went_wrong"),
      });
    } finally {
      setIsEmojiPickerOpen(false);
      setIsLogoUpdating(false);
    }
  };

  const fallbackLogo: TLogoProps = {
    in_use: "emoji" as const,
    emoji: { value: "128736", url: getEmojiImageUrlFromDecimal("128736") },
  };
  const projectLogo: TLogoProps = (project?.logo_props as TLogoProps) ?? fallbackLogo;

  const coverImage =
    project?.cover_image_url ??
    project?.cover_image ??
    "https://images.unsplash.com/photo-1672243775941-10d763d9adef?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80";

  const totalIssues = overviewData?.total_issues ?? 0;
  const openIssues = overviewData?.open_issues ?? 0;
  const completedIssues = overviewData?.completed_issues ?? 0;
  const cancelledIssues = overviewData?.cancelled_issues ?? 0;
  const membersCount = overviewData?.members ?? project?.members?.length ?? 0;

  const summaryCards =
    overviewData !== undefined
      ? [
          {
            key: "total_issues",
            label: "총 워크아이템",
            value: totalIssues,
            helper: totalIssues
              ? `완료 ${completedIssues.toLocaleString()} · 진행 ${openIssues.toLocaleString()}`
              : "작성된 워크아이템이 없습니다.",
          },
          {
            key: "open_issues",
            label: "진행 중",
            value: openIssues,
            helper: `취소 ${cancelledIssues.toLocaleString()}`,
          },
          {
            key: "completed_issues",
            label: "완료됨",
            value: completedIssues,
            helper: totalIssues ? `완료율 ${Math.round((completedIssues / Math.max(totalIssues, 1)) * 100)}%` : "",
          },
          {
            key: "members",
            label: "프로젝트 멤버",
            value: membersCount,
            helper: "",
          },
          {
            key: "cycles",
            label: "사이클",
            value: overviewData?.cycles ?? 0,
            helper: "",
          },
          {
            key: "modules",
            label: "모듈",
            value: overviewData?.modules ?? 0,
            helper: "",
          },
        ]
      : [];

  // Extended editor props for issue embed
  const { config: extendedEditorProps, modals: extendedEditorModals } = useExtendedEditorProps({
    workspaceSlug: slug ?? "",
    page: {} as any, // We don't need page instance for overview
    storeType: "project" as any,
    fetchEntity: useCallback(
      async (payload: TSearchEntityRequestPayload) =>
        await workspaceService.searchEntity(slug ?? "", {
          ...payload,
          project_id: pid ?? "",
        }),
      [slug, pid, workspaceService]
    ),
    getRedirectionLink: useCallback(() => "", []),
    projectId: pid,
  });

  const pageTitle = project?.name ? `${project.name} - Overview` : undefined;

  // Editor flagging
  const { document: documentEditorExtensions } = useEditorFlagging({
    workspaceSlug: slug ?? "",
  });

  // Mention handler
  const { fetchMentions } = useEditorMention({
    searchEntity: useCallback(
      async (payload: TSearchEntityRequestPayload) =>
        await workspaceService.searchEntity(slug ?? "", {
          ...payload,
          project_id: pid ?? "",
        }),
      [slug, pid, workspaceService]
    ),
  });

  const handleAssetUpload = async (blockId: string, file: File) => {
    if (!slug || !pid) return "";
    try {
      const { asset_id } = await uploadEditorAsset({
        blockId,
        data: {
          entity_identifier: pid,
          entity_type: EFileAssetType.PROJECT_DESCRIPTION,
        },
        file,
        projectId: pid,
        workspaceSlug: slug,
      });
      return asset_id;
    } catch (error) {
      console.error(error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: "Attachment upload failed. Please try again.",
      });
      throw error;
    }
  };

  // Realtime configuration for collaborative editing
  const webhookConnectionParams: TWebhookConnectionQueryParams = useMemo(
    () => ({
      documentType: "project_overview",
      projectId: pid ?? "",
      workspaceSlug: slug ?? "",
    }),
    [pid, slug]
  );

  const realtimeConfig: TRealtimeConfig | undefined = useMemo(() => {
    try {
      const LIVE_SERVER_BASE_URL = LIVE_BASE_URL?.trim() || window.location.origin;
      const WS_LIVE_URL = new URL(LIVE_SERVER_BASE_URL);
      const isSecureEnvironment = window.location.protocol === "https:";
      WS_LIVE_URL.protocol = isSecureEnvironment ? "wss" : "ws";
      WS_LIVE_URL.pathname = `${LIVE_BASE_PATH}/collaboration`;

      Object.entries(webhookConnectionParams)
        .filter(([_, value]) => value !== undefined && value !== null)
        .forEach(([key, value]) => {
          WS_LIVE_URL.searchParams.set(key, String(value));
        });

      return {
        url: WS_LIVE_URL.toString(),
      };
    } catch (error) {
      console.error("Error creating realtime config", error);
      return undefined;
    }
  }, [webhookConnectionParams]);

  const handleServerConnect = useCallback(() => {
    setHasConnectionFailed(false);
  }, []);

  const handleServerError = useCallback(() => {
    setHasConnectionFailed(true);
  }, []);

  const serverHandler: TServerHandler = useMemo(
    () => ({
      onConnect: handleServerConnect,
      onServerError: handleServerError,
      onStateChange: () => {},
    }),
    [handleServerConnect, handleServerError]
  );

  const userConfig = useMemo(
    () => ({
      id: currentUser?.id ?? "",
      name: currentUser?.display_name ?? "",
      color: hslToHex(generateRandomColor(currentUser?.id ?? "")),
    }),
    [currentUser?.display_name, currentUser?.id]
  );

  const fileHandler: TFileHandler = useMemo(
    () =>
      getEditorFileHandlers({
        projectId: pid ?? "",
        uploadFile: handleAssetUpload,
        duplicateFile: async () => "",
        workspaceId,
        workspaceSlug: slug ?? "",
      }),
    [getEditorFileHandlers, pid, workspaceId, slug, handleAssetUpload]
  );

  const handleEditorReady = useCallback((status: boolean) => {
    setEditorReady(status);
  }, []);

  return (
    <>
      <PageHead title={pageTitle} />

      <div className="flex h-full w-full flex-col overflow-hidden bg-custom-background-100">
        <div className="relative h-44 w-full">
          <img
            src={getFileURL(coverImage)}
            alt={`${project?.name ?? "Project"} cover`}
            className="h-full w-full object-cover"
          />
          {isAdmin && (
            <div className="absolute right-4 top-4">
              <ImagePickerPopover
                label={t("change_cover")}
                value={coverImage}
                control={coverPickerControl}
                onChange={handleCoverChange}
                disabled={isCoverUpdating}
                projectId={pid}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-6 left-6 flex items-center gap-3">
            <EmojiPicker
              iconType="material"
              isOpen={isEmojiPickerOpen}
              handleToggle={(val: boolean) => setIsEmojiPickerOpen(val)}
              label={<Logo logo={projectLogo} size={40} />}
              buttonClassName="flex h-[52px] w-[52px] items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
              closeOnSelect
              onChange={handleLogoChange}
              defaultIconColor={projectLogo?.in_use === "icon" ? projectLogo?.icon?.color : undefined}
              defaultOpen={projectLogo?.in_use === "emoji" ? EmojiIconPickerTypes.EMOJI : EmojiIconPickerTypes.ICON}
              className="flex items-center justify-center"
              disabled={!isAdmin || isLogoUpdating}
            />
            <div className="flex flex-col gap-1 text-white">
              <h1 className="text-2xl font-semibold leading-tight">{project?.name}</h1>
              {project?.identifier && <p className="text-sm text-white/80">{project.identifier}</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-12">
          <div className="mx-auto flex w-full max-w-8xl flex-col gap-6 px-4 py-8 md:px-10">
            <div className="rounded-lg border border-custom-border-200 bg-custom-background-100">
              {pid && realtimeConfig ? (
                <CollaborativeDocumentEditorWithRef
                  ref={editorRef}
                  id={`project-overview-${pid}`}
                  editable={isAdmin}
                  fileHandler={fileHandler}
                  handleEditorReady={handleEditorReady}
                  containerClassName="min-h-[480px] p-6"
                  realtimeConfig={realtimeConfig}
                  serverHandler={serverHandler}
                  user={userConfig}
                  disabledExtensions={documentEditorExtensions.disabled}
                  flaggedExtensions={documentEditorExtensions.flagged}
                  mentionHandler={{
                    searchCallback: async (query) => {
                      const res = await fetchMentions(query);
                      if (!res) throw new Error("Failed in fetching mentions");
                      return res;
                    },
                    renderComponent: EditorMentionsRoot,
                    getMentionedEntityDetails: (id) => ({
                      display_name: getUserDetails(id)?.display_name ?? "",
                    }),
                  }}
                  extendedEditorProps={extendedEditorProps}
                  getEditorMetaData={(_) => ({}) as any}
                />
              ) : (
                <div className="grid place-items-center min-h-[480px]">
                  <Spinner />
                </div>
              )}
            </div>

            <ProjectOverviewProgress data={overviewData} isLoading={isOverviewLoading} />

            {isOverviewLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Loader.Item key={`overview-metric-loader-${index}`} height="96px" width="100%" />
                ))}
              </div>
            ) : overviewData ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summaryCards.map((card) => (
                  <div
                    key={card.key}
                    className="rounded-lg border border-custom-border-200 bg-custom-background-100 p-5"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-custom-text-300">{card.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-custom-text-100">{card.value.toLocaleString()}</p>
                    {card.helper && card.helper !== "" && (
                      <p className="mt-1 text-xs text-custom-text-300">{card.helper}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-custom-border-200 bg-custom-background-100 p-6 text-sm text-custom-text-300">
                프로젝트 통계를 불러오는 데 문제가 발생했습니다. 새로고침 후 다시 시도해 주세요.
              </div>
            )}
          </div>
        </div>
      </div>
      {extendedEditorModals}
      <IssuePeekOverview />
    </>
  );
});
