import { Editor, Extension, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { v4 as uuidv4 } from "uuid";
// components
import { FileNode } from "./components";
// types
import { TFileHandler } from "@/types";
// helpers
import { insertEmptyParagraphAtNodeBoundaries } from "@/helpers/insert-empty-paragraph-at-node-boundary";

export type InsertFileAttachmentProps = {
  file?: File;
  pos?: number;
  event: "insert" | "drop";
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileAttachment: {
      insertFileAttachment: (props: InsertFileAttachmentProps) => ReturnType;
      uploadFile: (file: File) => () => Promise<string>;
      getFileSource?: (path: string) => () => Promise<string>;
      restoreFile: (src: string) => () => Promise<void>;
    };
  }
}

export interface FileAttachmentStorage {
  fileMap: Map<string, FileEntity>;
  uploadInProgress: boolean;
  maxFileSize: number;
}

export type FileEntity = ({ event: "insert" } | { event: "drop"; file: File }) & { hasStartedUpload?: boolean };

export const getFileAttachmentFileMap = (editor: Editor) =>
  (editor.storage.fileAttachment as FileAttachmentStorage | undefined)?.fileMap;

export const FileAttachment = (fileHandler: TFileHandler) => {
  const {
    getAssetSrc,
    upload,
    delete: deleteFileFn,
    restore: restoreFileFn,
    validation: { maxFileSize },
  } = fileHandler;

  return Extension.create<any, FileAttachmentStorage>({
    name: "fileAttachment",
    selectable: true,
    group: "block",
    atom: true,
    draggable: true,

    addStorage() {
      return {
        fileMap: new Map(),
        uploadInProgress: false,
        maxFileSize,
      };
    },

    addAttributes() {
      return {
        id: {
          default: null,
        },
        src: {
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
        fileExtension: {
          default: null,
        },
        uploadedAt: {
          default: null,
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: "file-attachment",
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return ["file-attachment", mergeAttributes(HTMLAttributes)];
    },

    addKeyboardShortcuts() {
      return {
        ArrowDown: insertEmptyParagraphAtNodeBoundaries("down", this.name),
        ArrowUp: insertEmptyParagraphAtNodeBoundaries("up", this.name),
      };
    },

    onCreate() {
      const fileSources = new Set<string>();
      this.editor.state.doc.descendants((node) => {
        if (node.type.name === this.name) {
          if (!node.attrs.src?.startsWith("http")) return;
          fileSources.add(node.attrs.src);
        }
      });
      fileSources.forEach(async (src) => {
        try {
          await restoreFileFn(src);
        } catch (error) {
          console.error("파일 복원 실패:", error);
        }
      });
    },

    addCommands() {
      return {
        insertFileAttachment:
          (props: InsertFileAttachmentProps) =>
          ({ commands }) => {
            if (props?.file && props.file.size > maxFileSize) {
              return false;
            }

            const fileId = uuidv4();
            const fileAttachmentFileMap = getFileAttachmentFileMap(this.editor);

            if (fileAttachmentFileMap) {
              if (props?.event === "drop" && props.file) {
                fileAttachmentFileMap.set(fileId, {
                  file: props.file,
                  event: props.event,
                });
              } else if (props.event === "insert") {
                fileAttachmentFileMap.set(fileId, {
                  event: props.event,
                  hasStartedUpload: false,
                });
              }
            }

            const attributes = {
              id: fileId,
            };

            if (props.pos) {
              return commands.insertContentAt(props.pos, {
                type: this.name,
                attrs: attributes,
              });
            }
            return commands.insertContent({
              type: this.name,
              attrs: attributes,
            });
          },

        uploadFile: (file: File) => async () => {
          try {
            const fileUrl = await upload(file);
            return fileUrl;
          } catch (error) {
            console.error("파일 업로드 실패:", error);
            throw error;
          }
        },

        getFileSource: (path: string) => async () => await getAssetSrc(path),

        restoreFile: (src: string) => async () => {
          await restoreFileFn(src);
        },
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(FileNode, {
        props: {
          fileHandler,
        },
      });
    },
  });
}; 