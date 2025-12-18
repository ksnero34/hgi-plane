import { mergeAttributes, Node, Extension } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
// components
import { FileNode } from "./components/file-node";
// types
import type { TFileHandler } from "@/types";

export const CustomReadOnlyFileExtension = (props: Pick<TFileHandler, "getAssetSrc" | "getAssetDownloadSrc">) => {
  const { getAssetSrc, getAssetDownloadSrc } = props;

  const FileComponent = Node.create({
    name: "fileComponent",
    selectable: false,
    group: "block",
    atom: true,
    draggable: false,

    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (element) => element.getAttribute("id") || element.getAttribute("fileId"),
        },
        fileId: {
          default: null,
          parseHTML: (element) => element.getAttribute("fileId") || element.getAttribute("id"),
        },
        fileName: {
          default: null,
          parseHTML: (element) => element.getAttribute("fileName") || element.getAttribute("filename"),
        },
        fileSize: {
          default: null,
          parseHTML: (element) => {
            const size = element.getAttribute("fileSize") || element.getAttribute("filesize");
            return size ? parseInt(size, 10) : null;
          },
        },
        fileType: {
          default: null,
          parseHTML: (element) => element.getAttribute("fileType") || element.getAttribute("filetype"),
        },
        uploadStatus: {
          default: "success",
          parseHTML: (element) => element.getAttribute("uploadStatus") || element.getAttribute("uploadstatus"),
        },
        errorMessage: {
          default: null,
          parseHTML: (element) => element.getAttribute("errorMessage") || element.getAttribute("errormessage"),
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: "file-component",
        },
        {
          tag: "div[data-type='file-component']",
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return ["file-component", mergeAttributes(HTMLAttributes, { "data-type": "file-component" })];
    },

    addNodeView() {
      return ReactNodeViewRenderer(FileNode as any);
    },
  });

  return Extension.create({
    name: "customFile",

    addExtensions() {
      return [FileComponent];
    },

    addStorage() {
      return {
        fileMap: new Map(),
        markdown: {
          serialize() {},
        },
        fileHandler: {
          getAssetSrc: async (path: string) => {
            try {
              return await getAssetSrc(path);
            } catch (error) {
              console.error("Error getting file URL:", error);
              return "";
            }
          },
          getAssetDownloadSrc: async (path: string) => {
            try {
              return await (getAssetDownloadSrc ? getAssetDownloadSrc(path) : getAssetSrc(path));
            } catch (error) {
              console.error("Error getting file download URL:", error);
              return "";
            }
          },
          upload: async () => "",
          delete: async () => {},
          restore: async () => {},
          validateFile: async () => true,
        },
      };
    },
  });
};
