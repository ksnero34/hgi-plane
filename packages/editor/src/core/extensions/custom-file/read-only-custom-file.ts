import { mergeAttributes } from "@tiptap/core";
import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
// components
import { FileNode } from "./components/file-node";
// types
import { TFileHandler } from "@/types";

export const CustomReadOnlyFileExtension = (props: Pick<TFileHandler, "getAssetSrc">) => {
  const { getAssetSrc } = props;

  return Node.create({
    name: "fileComponent",
    selectable: false,
    group: "block",
    atom: true,
    draggable: false,

    addAttributes() {
      return {
        fileId: {
          default: null,
        },
        fileName: {
          default: null,
        },
        fileSize: {
          default: null,
        },
        fileType: {
          default: null,
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: "file-component",
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return ["file-component", mergeAttributes(HTMLAttributes)];
    },

    addStorage() {
      return {
        fileMap: new Map(),
        markdown: {
          serialize() {},
        },
      };
    },

    addCommands() {
      return {
        getFileSource: (path: string) => async () => await getAssetSrc(path),
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(FileNode);
    },
  });
}; 