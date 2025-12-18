import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// local imports
import { WorkItemEmbedExtensionConfig } from "./extension-config";

type Props = {
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
};

export function WorkItemEmbedExtension(props: Props) {
  return WorkItemEmbedExtensionConfig.extend({
    addNodeView() {
      return ReactNodeViewRenderer((issueProps: NodeViewProps) => (
        <NodeViewWrapper>
          {props.widgetCallback({
            issueId: issueProps.node.attrs.entity_identifier,
            projectId: issueProps.node.attrs.project_identifier,
            workspaceSlug: issueProps.node.attrs.workspace_identifier,
            attributes: issueProps.node.attrs,
          })}
        </NodeViewWrapper>
      ));
    },
  });
}
