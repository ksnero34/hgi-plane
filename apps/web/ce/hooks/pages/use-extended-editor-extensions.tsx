import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
// editor
import { CORE_EXTENSIONS } from "@plane/editor";
import type { ISearchIssueResponse, TSearchEntityRequestPayload, TSearchResponse } from "@plane/types";
// components
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
// hooks
import { useIssueEmbed } from "@/plane-web/hooks/use-issue-embed";
import type { TPageInstance } from "@/store/pages/base-page";
import type { EPageStoreType } from "../store";

export type TExtendedEditorExtensionsHookParams = {
  workspaceSlug: string;
  page: TPageInstance;
  storeType: EPageStoreType;
  fetchEntity: (payload: TSearchEntityRequestPayload) => Promise<TSearchResponse>;
  getRedirectionLink: (pageId?: string) => string;
  extensionHandlers?: Map<string, unknown>;
  projectId?: string;
};

type IssueEmbedExtensionConfig = {
  widgetCallback: (payload: any) => ReactNode;
  onInsertRequest?: (payload: any) => void;
};

export type TExtendedEditorExtensionsConfig = {
  embeds?: {
    issue?: IssueEmbedExtensionConfig;
  };
};

export type TExtendedEditorExtensionsHookReturn = {
  config: TExtendedEditorExtensionsConfig;
  modals: ReactNode;
};

export const useExtendedEditorProps = (
  params: TExtendedEditorExtensionsHookParams
): TExtendedEditorExtensionsHookReturn => {
  const { workspaceSlug, projectId } = params;
  const [isIssueEmbedModalOpen, setIsIssueEmbedModalOpen] = useState(false);
  const [issueEmbedContext, setIssueEmbedContext] = useState<{ editor: any; position: number } | null>(null);

  const handleCloseIssueEmbedModal = useCallback(() => {
    setIsIssueEmbedModalOpen(false);
    setIssueEmbedContext(null);
  }, []);

  const handleIssueEmbedInsertRequest = useCallback((payload: any) => {
    const editor = payload?.editor;
    const range = payload?.range;
    if (!editor || !range) return;

    const position = range.from;
    editor.chain().focus().deleteRange(range).setTextSelection(position).run();
    setIssueEmbedContext({ editor, position });
    setIsIssueEmbedModalOpen(true);
  }, []);

  const { widgetCallback: issueEmbedWidgetCallback } = useIssueEmbed();

  const issueEmbedConfig = useMemo(
    () => ({
      widgetCallback: issueEmbedWidgetCallback,
      onInsertRequest: handleIssueEmbedInsertRequest,
    }),
    [handleIssueEmbedInsertRequest, issueEmbedWidgetCallback]
  );

  const handleIssueEmbedSubmit = useCallback(
    async (issues: ISearchIssueResponse[]) => {
      const selectedIssue = issues[0];
      if (!selectedIssue || !issueEmbedContext) {
        handleCloseIssueEmbedModal();
        return;
      }
      const { editor, position } = issueEmbedContext;

      editor
        .chain()
        .focus()
        .insertContentAt(position, {
          type: CORE_EXTENSIONS.WORK_ITEM_EMBED,
          attrs: {
            entity_identifier: selectedIssue.id,
            project_identifier: selectedIssue.project_id,
            workspace_identifier: selectedIssue.workspace__slug,
            id: selectedIssue.id,
            entity_name: "issue",
            project_slug: selectedIssue.project__identifier,
            issue_title: selectedIssue.name,
            issue_sequence_id: selectedIssue.sequence_id,
            issue_state_name: selectedIssue.state__name,
            issue_state_group: selectedIssue.state__group,
            issue_state_color: selectedIssue.state__color,
          },
        })
        .setTextSelection(position + 1)
        .run();

      handleCloseIssueEmbedModal();
    },
    [handleCloseIssueEmbedModal, issueEmbedContext]
  );

  const config = useMemo<TExtendedEditorExtensionsConfig>(
    () => ({
      embeds: {
        issue: issueEmbedConfig,
      },
    }),
    [issueEmbedConfig]
  );

  const modals = (
    <ExistingIssuesListModal
      isOpen={isIssueEmbedModalOpen}
      handleClose={handleCloseIssueEmbedModal}
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      searchParams={{}}
      handleOnSubmit={handleIssueEmbedSubmit}
      workspaceLevelToggle
    />
  );

  return {
    config,
    modals,
  };
};
