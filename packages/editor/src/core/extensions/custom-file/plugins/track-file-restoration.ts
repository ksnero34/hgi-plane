import { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

export const TrackFileRestorationPlugin = (editor: Editor, restoreFile: (fileId: string) => Promise<void>, nodeName: string) =>
  new Plugin({
    key: new PluginKey("track-file-restoration"),
    appendTransaction: (transactions, oldState, newState) => {
      // Check if any transaction is changing the doc
      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged) return null;

      const filesToRestore = new Set<string>();

      // Find all file nodes in the new state
      newState.doc.descendants((node, pos) => {
        if (node.type.name === nodeName) {
          const fileId = node.attrs.fileId;
          if (fileId) {
            filesToRestore.add(fileId);
          }
        }
      });

      // Restore files
      filesToRestore.forEach(async (fileId) => {
        try {
          await restoreFile(fileId);
        } catch (error) {
          console.error("Error restoring file:", error);
        }
      });

      return null;
    },
  }); 