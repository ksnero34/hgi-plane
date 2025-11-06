"use client";

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EFileAssetType, TLogoProps } from "@plane/types";
import { useTranslation } from "@plane/i18n";
import type { TProjectOverviewSnapshot } from "@plane/types";
import { Button } from "@plane/propel/button";
import { EmojiPicker, EmojiIconPickerTypes } from "@plane/propel/emoji-icon-picker";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Avatar, Loader } from "@plane/ui";
import { getEmojiImageUrlFromDecimal, getFileURL, getTextContent } from "@plane/utils";
// plane web components
import { ImagePickerPopover } from "@/components/core/image-picker-popover";
import { PageHead } from "@/components/core/page-title";
import { RichTextEditor } from "@/components/editor/rich-text";
import { Logo } from "@/components/common/logo";
// hooks
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";
// services
import { ProjectService } from "@/services/project";
import { WorkspaceService } from "@/services/workspace.service";
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
  const { getProjectById, updateProject } = useProject();
  const { getWorkspaceBySlug } = useWorkspace();
  const { uploadEditorAsset } = useEditorAsset();
  const { allowPermissions } = useUserPermissions();
  const workspaceService = useMemo(() => new WorkspaceService(), []);
  const { control: coverPickerControl } = useForm<TCoverPickerForm>({
    defaultValues: { search: "" },
  });

  const project = pid ? getProjectById(pid) : undefined;
  const workspaceId = slug ? getWorkspaceBySlug(slug)?.id?.toString() ?? "" : "";
  const isAdmin =
    !!slug &&
    !!pid &&
    allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, slug, pid);

  const {
    data: overviewData,
    isLoading: isOverviewLoading,
  } = useSWR<TProjectOverviewSnapshot>(
    slug && pid ? ["project-overview", slug, pid] : null,
    () => projectService.getProjectOverview(slug!, pid!),
    {
      revalidateOnFocus: false,
    }
  );

  const [editorContent, setEditorContent] = useState<string>(() => {
    const initial = project?.overview_html ?? project?.description_html;
    if (initial && initial.trim() !== "" && initial !== "<p></p>") return initial;
    return DEFAULT_PROJECT_OVERVIEW_HTML;
  });
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCoverUpdating, setIsCoverUpdating] = useState<boolean>(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState<boolean>(false);
  const [isLogoUpdating, setIsLogoUpdating] = useState<boolean>(false);

  useEffect(() => {
    const incoming = project?.overview_html ?? project?.description_html;
    if (!incoming || incoming.trim() === "" || incoming === "<p></p>") {
      if (!hasChanges) {
        setEditorContent(DEFAULT_PROJECT_OVERVIEW_HTML);
        setHasChanges(false);
      }
      return;
    }
    if (!hasChanges) {
      setEditorContent(incoming);
      setHasChanges(false);
    }
  }, [project?.overview_html, project?.description_html, hasChanges]);

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

  const handleSaveOverview = async () => {
    if (!slug || !pid) return;
    setIsSaving(true);
    try {
      const plainText = getTextContent(editorContent || "");
      await updateProject(slug, pid, {
        overview: plainText,
        overview_html: editorContent || "<p></p>",
        overview_text: plainText,
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("toast.success"),
        message: "Project overview updated.",
      });
      setHasChanges(false);
    } catch (error) {
      console.error(error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: "Unable to save overview. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
    emoji: { value: "128736", url: getEmojiImageUrlFromDecimal("128736") }
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
  const pageTitle = project?.name ? `${project.name} - Overview` : undefined;

  const handleMentionSearch = async (payload: any) =>
    workspaceService.searchEntity(slug ?? "", {
      ...payload,
      project_id: pid ?? "",
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

  const editorEditableProps = isAdmin
    ? {
        editable: true as const,
        dragDropEnabled: true,
        searchMentionCallback: handleMentionSearch,
        uploadFile: handleAssetUpload,
      }
    : {
        editable: false as const,
      };

  return (
    <>
      <PageHead title={pageTitle} />
      <Head>
        <title>{project?.name ? `${project.name} - Overview` : "Project overview"}</title>
      </Head>
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
              defaultIconColor={
                projectLogo?.in_use === "icon" ? projectLogo?.icon?.color : undefined
              }
              defaultOpen={
                projectLogo?.in_use === "emoji" ? EmojiIconPickerTypes.EMOJI : EmojiIconPickerTypes.ICON
              }
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
            {isAdmin && (
              <div className="flex items-center justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!hasChanges || isSaving}
                  onClick={handleSaveOverview}
                >
                  {isSaving ? t("saving") : t("save_changes")}
                </Button>
              </div>
            )}

            <div className="rounded-lg border border-custom-border-200 bg-custom-background-100">
              <RichTextEditor
                id="project-overview-editor"
                initialValue={editorContent}
                value={editorContent}
                workspaceSlug={slug ?? ""}
                workspaceId={workspaceId}
                projectId={pid}
                containerClassName="min-h-[480px] pt-6"
                {...editorEditableProps}
                onChange={(_value, html) => {
                  if (!isAdmin) return;
                  setEditorContent(html);
                  setHasChanges(true);
                }}
              />
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
    </>
  );
});
