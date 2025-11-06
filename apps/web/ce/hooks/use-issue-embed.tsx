import { useCallback } from "react";
// plane web components
import { IssueEmbedCard } from "@/components/pages/editor/embed/issue-embed-card";

export const useIssueEmbed = () => {
  const widgetCallback = useCallback((payload: any) => {
    const { issueId, projectId, workspaceSlug, attributes = {} } = payload ?? {};

    return (
      <IssueEmbedCard
        issueId={issueId}
        projectId={projectId}
        workspaceSlug={workspaceSlug}
        attributes={attributes}
      />
    );
  }, []);

  return {
    widgetCallback,
  };
};
