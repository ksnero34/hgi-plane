import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { v4 as uuid } from "uuid";
import { NodeViewProps } from "@tiptap/react";
import { FileNode } from "./components/file-node";

export interface InsertFileComponentProps {
  event: "insert" | "drop";
  pos?: number;
  file?: File;
}

export interface CustomFileOptions {
  HTMLAttributes: Record<string, any>;
}

export interface CustomBaseFileNodeViewProps extends NodeViewProps {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadStatus: "uploading" | "success" | "error";
  onDelete?: () => void;
  onDownload?: () => void;
}

export interface FileStorage {
  fileMap: Map<string, FileEntity>;
}

export type FileEntity = {
  file?: File;
  event: "insert" | "drop";
  hasOpenedFileInputOnce?: boolean;
};

export const getFileComponentFileMap = (editor: any) =>
  (editor.storage.customFile as FileStorage | undefined)?.fileMap;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customFile: {
      insertFileComponent: (options: { event: "insert" | "drop"; pos?: number; file?: File }) => ReturnType;
    };
  }
}

export interface FileHandler {
  upload: (file: File) => Promise<string>;
  delete: (fileId: string) => Promise<void>;
}

export const CustomFileExtension = (props: FileHandler) => {
  const { upload, delete: deleteFile } = props;

  return Node.create({
    name: "customFile",
    group: "block",
    atom: true,
    draggable: true,

    addStorage() {
      return {
        fileMap: new Map<string, FileEntity>(),
      };
    },

    addAttributes() {
      return {
        fileId: {
          default: uuid(),
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
          default: "uploading",
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: "div[data-type='custom-file']",
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return ["div", { "data-type": "custom-file", ...HTMLAttributes }, 0];
    },

    addCommands() {
      return {
        insertFileComponent:
          (options) =>
          ({ commands }) => {
            const fileId = uuid();
            const fileMap = getFileComponentFileMap(this.editor);

            if (fileMap) {
              if (options.event === "drop" && options.file) {
                fileMap.set(fileId, {
                  file: options.file,
                  event: options.event,
                });
              } else if (options.event === "insert") {
                fileMap.set(fileId, {
                  event: options.event,
                  hasOpenedFileInputOnce: false,
                });
              }
            }

            return commands.insertContent({
              type: this.name,
              attrs: {
                fileId,
              },
            });
          },
        uploadFile:
          (file: File) =>
          async () => {
            try {
              const url = await upload(file);
              return url;
            } catch (error) {
              console.error("Error uploading file:", error);
              throw error;
            }
          },
        deleteFile:
          (fileId: string) =>
          async () => {
            try {
              await deleteFile(fileId);
            } catch (error) {
              console.error("Error deleting file:", error);
              throw error;
            }
          },
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(FileNode);
    },
  });
}; 