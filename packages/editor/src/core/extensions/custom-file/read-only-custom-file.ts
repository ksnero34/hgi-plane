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
    selectable: true,
    group: "block",
    atom: true,
    draggable: false,

    addAttributes() {
      return {
        id: {
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
        uploadStatus: {
          default: "success",
        },
      };
    },

    parseHTML() {
      return [{
        tag: "file-component",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) {
            // console.log("[ReadOnlyFileExtension] parseHTML: node is not HTMLElement");
            return {};
          }
          
          // console.log("[ReadOnlyFileExtension] parseHTML raw node attributes:", {
          //   id: node.getAttribute("id"),
          //   fileName: node.getAttribute("fileName"),
          //   filename: node.getAttribute("filename"),
          //   fileSize: node.getAttribute("fileSize"),
          //   filesize: node.getAttribute("filesize"),
          //   fileType: node.getAttribute("fileType"),
          //   filetype: node.getAttribute("filetype"),
          //   uploadStatus: node.getAttribute("uploadStatus"),
          //   uploadstatus: node.getAttribute("uploadstatus")
          // });
          
          // 모든 가능한 속성 이름을 매핑
          const attrs = {
            id: node.getAttribute("id") || node.getAttribute("data-id"),
            fileName: node.getAttribute("fileName") || node.getAttribute("filename") || node.getAttribute("data-filename"),
            fileSize: node.getAttribute("fileSize") || node.getAttribute("filesize") || node.getAttribute("data-filesize"),
            fileType: node.getAttribute("fileType") || node.getAttribute("filetype") || node.getAttribute("data-filetype"),
            uploadStatus: node.getAttribute("uploadStatus") || node.getAttribute("uploadstatus") || "success"
          };
          
          // 빈 문자열이나 null 값 제거 (uploadStatus와 id 제외)
          Object.keys(attrs).forEach(key => {
            const value = attrs[key];
            if ((value === null || value === "") && key !== "uploadStatus" && key !== "id") {
              delete attrs[key];
            }
          });
          
          // console.log("[ReadOnlyFileExtension] parseHTML processed attributes:", attrs);
          
          return attrs;
        }
      }];
    },

    renderHTML({ HTMLAttributes }) {
      // console.log("[ReadOnlyFileExtension] renderHTML input attributes:", HTMLAttributes);
      
      const attrs = {
        "data-id": HTMLAttributes.id,
        "data-file-name": HTMLAttributes.fileName,
        "data-file-size": HTMLAttributes.fileSize,
        "data-file-type": HTMLAttributes.fileType,
        "data-upload-status": HTMLAttributes.uploadStatus || "success",
      };
      
      // falsy 값 제거 (uploadStatus 제외)
      Object.keys(attrs).forEach(key => {
        const value = attrs[key];
        if ((value === null || value === "") && key !== "data-upload-status") {
          delete attrs[key];
        }
      });
      
      // console.log("[ReadOnlyFileExtension] renderHTML final attributes:", attrs);
      
      return ["file-component", mergeAttributes(attrs)];
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