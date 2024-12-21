import { Node, Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { v4 as uuid } from "uuid";
import { NodeViewProps } from "@tiptap/react";
import { FileNode } from "./components/file-node";
import { TrackFileDeletionPlugin } from "./plugins/track-file-deletion";
import { TrackFileRestorationPlugin } from "./plugins/track-file-restoration";
import { Extension } from "@tiptap/core";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { insertEmptyParagraphAtNodeBoundaries } from "@/helpers/insert-empty-paragraph-at-node-boundary";

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
  editor: Editor;
  setFailedToLoadFile: (failed: boolean) => void;
  getPos: () => number;
  updateAttributes: (attrs: Record<string, any>) => void;
}

export interface FileStorage {
  fileMap: Map<string, FileEntity>;
  markdown: {
    serialize: () => void;
  };
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
      uploadFile: (file: File) => () => Promise<string>;
      deleteFile: (fileId: string) => () => Promise<void>;
      restoreFile: (fileId: string) => () => Promise<void>;
      validateFile: (file: File) => boolean;
    };
  }
}

export interface FileHandler {
  upload: (file: File) => Promise<string>;
  delete: (fileId: string) => Promise<void>;
  restore: (fileId: string) => Promise<void>;
  validateFile?: (file: File) => boolean;
}

export const CustomFileExtension = (fileHandler: FileHandler) => {
  const FileComponent = Node.create({
    name: "fileComponent",
    group: "block",
    atom: true,
    draggable: true,
    selectable: true,

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
          default: "uploading",
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: "div[data-type='file-component']",
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return ["div", { "data-type": "file-component", ...HTMLAttributes }];
    },

    addKeyboardShortcuts() {
      return {
        ArrowDown: insertEmptyParagraphAtNodeBoundaries("down", this.name),
        ArrowUp: insertEmptyParagraphAtNodeBoundaries("up", this.name),
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(FileNode);
    },
  });

  return Extension.create({
    name: "customFile",

    addExtensions() {
      return [FileComponent];
    },

    addStorage() {
      return {
        fileMap: new Map<string, FileEntity>(),
        uploadInProgress: false,
        markdown: {
          serialize: () => {},
        },
      };
    },

    addCommands() {
      return {
        insertFileComponent:
          (props: InsertFileComponentProps) =>
          ({ commands }) => {
            if (props?.file && fileHandler.validateFile) {
              const isValid = fileHandler.validateFile(props.file);
              if (!isValid) return false;
            }

            const id = uuid();
            
            this.editor.storage.customFile.fileMap.set(id, {
              event: props.event,
              file: props.file,
              hasOpenedFileInputOnce: false,
            });

            const attributes = {
              id,
              uploadStatus: "uploading",
            };

            if (props.pos) {
              return commands.insertContentAt(props.pos, {
                type: "fileComponent",
                attrs: attributes,
              });
            }

            return commands.insertContent({
              type: "fileComponent",
              attrs: attributes,
            });
          },
        uploadFile:
          (file: File) =>
          async () => {
            try {
              const url = await fileHandler.upload(file);
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
              await fileHandler.delete(fileId);
            } catch (error) {
              console.error("Error deleting file:", error);
              // 에러가 발생해도 계속 진행
            }
          },
        restoreFile:
          (fileId: string) =>
          async () => {
            try {
              await fileHandler.restore(fileId);
            } catch (error) {
              console.error("Error restoring file:", error);
              throw error;
            }
          },
        validateFile: (file: File) => {
          if (fileHandler.validateFile) {
            return fileHandler.validateFile(file);
          }
          return true;
        },
      };
    },

    addProseMirrorPlugins() {
      const upload = async (file: File, pos: number) => {
        try {
          const url = await fileHandler.upload(file);
          if (!url) throw new Error("Failed to upload file");

          const { state, dispatch } = this.editor.view;
          const node = state.doc.nodeAt(pos);
          
          if (node) {
            dispatch(
              state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                uploadStatus: "success",
              })
            );
          }
        } catch (error) {
          console.error("Error uploading file:", error);
          const { state, dispatch } = this.editor.view;
          const node = state.doc.nodeAt(pos);
          
          if (node) {
            dispatch(
              state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                uploadStatus: "error",
              })
            );
          }
        }
      };

      return [
        new Plugin({
          key: new PluginKey("customFile"),
          props: {
            handleDOMEvents: {
              drop: (view, event) => {
                const hasFiles = event.dataTransfer?.files?.length;
                if (!hasFiles) return false;

                const file = event.dataTransfer.files[0];
                if (!file) return false;

                const coordinates = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });

                if (!coordinates) return false;

                const id = uuid();
                const node = view.state.schema.nodes.fileComponent.create({
                  id,
                  uploadStatus: "uploading",
                });

                const transaction = view.state.tr.insert(coordinates.pos, node);
                view.dispatch(transaction);

                this.storage.fileMap.set(id, {
                  event: "drop",
                  file,
                });

                return true;
              },
            },
          },
        }),
        TrackFileDeletionPlugin(this.editor, fileHandler.delete, this.storage),
        TrackFileRestorationPlugin(this.editor, fileHandler.restore, this.storage),
      ];
    },
  });
}; 