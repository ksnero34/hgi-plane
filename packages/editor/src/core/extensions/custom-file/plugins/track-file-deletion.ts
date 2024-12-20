import { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

export const TrackFileDeletionPlugin = (editor: Editor, deleteFile: (fileId: string) => Promise<void>, nodeName: string) =>
  new Plugin({
    key: new PluginKey("track-file-deletion"),
    appendTransaction: (transactions, oldState, newState) => {
      // Check if any transaction is changing the doc
      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged) return null;

      const deletedFiles = new Set<string>();

      // Find all file nodes in the old state
      oldState.doc.descendants((node, pos) => {
        if (node.type.name === nodeName) {
          const fileId = node.attrs.fileId;
          if (fileId) {
            // Check if this node exists in the new state at the same position
            const newNode = newState.doc.nodeAt(pos);
            if (!newNode || newNode.type.name !== nodeName) {
              deletedFiles.add(fileId);
            }
          }
        }
      });

      // Delete files that were removed
      deletedFiles.forEach(async (fileId) => {
        try {
          await deleteFile(fileId);
        } catch (error) {
          console.error("Error deleting file:", error);
        }
      });

      return null;
    },
  }); 