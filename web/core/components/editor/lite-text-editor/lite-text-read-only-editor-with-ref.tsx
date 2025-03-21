import React, { useImperativeHandle } from "react";
import { EditorContent } from "@tiptap/react";
import { EditorReadOnlyRefApi, LiteTextReadOnlyEditorProps, useLiteReadOnlyEditor } from "@plane/editor";

export const LiteTextReadOnlyEditorWithRef = React.forwardRef<EditorReadOnlyRefApi, LiteTextReadOnlyEditorProps>(
  ({ fileHandler, ...props }, ref) => {
    // console.log("[LiteTextReadOnlyEditorWithRef] Initializing with:", {
    //   fileHandler,
    //   initialValue: props.initialValue,
    //   disabledExtensions: props.disabledExtensions
    // });

    if (!fileHandler) {
    //   console.error("[LiteTextReadOnlyEditorWithRef] No file handler provided");
      return null;
    }

    try {
    //   console.log("[LiteTextReadOnlyEditorWithRef] Creating editor with:", {
    //     fileHandler: {
    //       ...fileHandler,
    //       getAssetSrc: "function",
    //       restore: "function",
    //       validateFile: "function"
    //     },
    //     props: {
    //       ...props,
    //       initialValue: props.initialValue?.length > 100 
    //         ? props.initialValue.substring(0, 100) + "..." 
    //         : props.initialValue
    //     }
    //   });

      let editor;
      try {
        editor = useLiteReadOnlyEditor({
          fileHandler,
          ...props,
        });
      } catch (editorError) {
        console.error("[LiteTextReadOnlyEditorWithRef] Error creating editor:", editorError);
        return null;
      }

    //   console.log("[LiteTextReadOnlyEditorWithRef] Editor created:", {
    //     isNull: editor === null,
    //     isUndefined: editor === undefined,
    //     hasExtensionManager: !!editor?.extensionManager,
    //     extensions: editor?.extensionManager?.extensions?.map(e => ({
    //       name: e.name,
    //       options: e.options,
    //       storage: e.storage
    //     }))
    //   });

      if (!editor) {
        console.error("[LiteTextReadOnlyEditorWithRef] Editor is null or undefined after creation");
        return null;
      }

      if (!editor.extensionManager) {
        console.error("[LiteTextReadOnlyEditorWithRef] Editor has no extension manager");
        return null;
      }

      useImperativeHandle(
        ref,
        () => ({
          getEditorContent: () => {
            try {
              const content = editor?.getHTML() ?? "";
            //   console.log("[LiteTextReadOnlyEditorWithRef] Editor content:", 
            //     content.length > 100 ? content.substring(0, 100) + "..." : content
            //   );
              return content;
            } catch (error) {
              console.error("[LiteTextReadOnlyEditorWithRef] Error getting editor content:", error);
              return "";
            }
          },
          getEditorJSON: () => {
            try {
              const json = editor?.getJSON();
            //   console.log("[LiteTextReadOnlyEditorWithRef] Editor JSON:", json);
              return json;
            } catch (error) {
              console.error("[LiteTextReadOnlyEditorWithRef] Error getting editor JSON:", error);
              return null;
            }
          },
          getEditorInstance: () => editor,
        }),
        [editor]
      );

      // console.log("[LiteTextReadOnlyEditorWithRef] Rendering editor with extensions:", 
      //   editor.extensionManager.extensions.map(e => e.name));

      return (
        <EditorContent
          editor={editor}
          {...props}
        />
      );
    } catch (error) {
      console.error("[LiteTextReadOnlyEditorWithRef] Error in component:", error);
      return null;
    }
  }
); 