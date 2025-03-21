import React from "react";
// plane imports
import { EditorReadOnlyRefApi, ILiteTextReadOnlyEditor, LiteTextReadOnlyEditorWithRef } from "@plane/editor";
import { MakeOptional } from "@plane/types";
// components
import { EditorMentionsRoot } from "@/components/editor";
// helpers
import { cn } from "@/helpers/common.helper";
// hooks
import { useEditorConfig } from "@/hooks/editor";
// plane web hooks
import { useEditorFlagging } from "@/plane-web/hooks/use-editor-flagging";

type LiteTextReadOnlyEditorWrapperProps = MakeOptional<
  Omit<ILiteTextReadOnlyEditor, "fileHandler" | "mentionHandler">,
  "disabledExtensions"
> & {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
};

export const LiteTextReadOnlyEditor = React.forwardRef<EditorReadOnlyRefApi, LiteTextReadOnlyEditorWrapperProps>(
  ({ workspaceId, workspaceSlug, projectId, disabledExtensions: additionalDisabledExtensions, ...props }, ref) => {
    // editor flaggings
    const { liteTextEditor: disabledExtensions } = useEditorFlagging(workspaceSlug?.toString());
    // editor config
    const { getReadOnlyEditorFileHandlers } = useEditorConfig();

    // console.log("[LiteTextReadOnlyEditor] Initializing with:", {
    //   workspaceId,
    //   workspaceSlug,
    //   projectId,
    //   props
    // });

    const fileHandler = React.useMemo(() => {
      // console.log("[LiteTextReadOnlyEditor] Creating file handler");
      const handler = getReadOnlyEditorFileHandlers({
        projectId,
        workspaceId,
        workspaceSlug,
      });
      // console.log("[LiteTextReadOnlyEditor] Created file handler:", handler);
      return handler;
    }, [getReadOnlyEditorFileHandlers, projectId, workspaceId, workspaceSlug]);

    if (!fileHandler) {
      // console.error("[LiteTextReadOnlyEditor] Failed to create file handler");
      return null;
    }

    try {
      return (
        <LiteTextReadOnlyEditorWithRef
          ref={ref}
          disabledExtensions={[...disabledExtensions, ...(additionalDisabledExtensions ?? [])]}
          fileHandler={fileHandler}
          mentionHandler={{
            renderComponent: (props) => <EditorMentionsRoot {...props} />,
          }}
          {...props}
          containerClassName={cn(props.containerClassName, "relative p-2")}
        />
      );
    } catch (error) {
      console.error("[LiteTextReadOnlyEditor] Error rendering editor:", error);
      return null;
    }
  }
);

LiteTextReadOnlyEditor.displayName = "LiteTextReadOnlyEditor";
