import type { CommandProps } from "@/types";

export type TEmbedConfig = {
  issue?: TIssueEmbedConfig;
};

export type TReadOnlyEmbedConfig = TEmbedConfig;

export type TIssueEmbedConfig = {
  widgetCallback: ({
    issueId,
    projectId,
    workspaceSlug,
    attributes,
  }: {
    issueId: string;
    projectId: string | undefined;
    workspaceSlug: string | undefined;
    attributes: Record<string, any>;
  }) => React.ReactNode;
  onInsertRequest?: (context: CommandProps) => void;
};
