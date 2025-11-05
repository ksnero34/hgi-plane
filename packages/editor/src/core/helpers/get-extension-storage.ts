import type { Editor } from "@tiptap/core";

/**
 * Get the storage object for a specific extension
 * @param editor - The TipTap editor instance
 * @param extensionName - The name of the extension
 * @returns The storage object for the extension, or undefined if not found
 */
export const getExtensionStorage = <T = any>(editor: Editor, extensionName: string): T | undefined => {
  return editor.storage[extensionName] as T | undefined;
};
