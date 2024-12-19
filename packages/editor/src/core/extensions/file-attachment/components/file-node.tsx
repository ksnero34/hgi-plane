import { useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
// components
import { FileBlock } from "./file-block";
import { FileUploader } from "./file-uploader";
import { FileToolbar } from "./toolbar";
// types
import { TFileHandler } from "@/types";

export type FileAttachmentAttributes = {
  id: string;
  src: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  fileExtension: string | null;
  uploadedAt: string | null;
};

export type FileNodeProps = NodeViewProps & {
  fileHandler: TFileHandler;
  node: NodeViewProps["node"] & {
    attrs: FileAttachmentAttributes;
  };
};

export const FileNode = (props: FileNodeProps) => {
  const { editor, fileHandler, node, getPos, updateAttributes, selected } = props;
  const { src: fileSrc } = node.attrs;

  const [isUploaded, setIsUploaded] = useState(false);
  const [fileFromFileSystem, setFileFromFileSystem] = useState<string | undefined>(undefined);
  const [failedToLoad, setFailedToLoad] = useState(false);

  const [editorContainer, setEditorContainer] = useState<HTMLDivElement | null>(null);
  const fileComponentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closestEditorContainer = fileComponentRef.current?.closest(".editor-container");
    if (closestEditorContainer) {
      setEditorContainer(closestEditorContainer as HTMLDivElement);
    }
  }, []);

  useEffect(() => {
    if (fileSrc) {
      setIsUploaded(true);
      setFileFromFileSystem(undefined);
    } else {
      setIsUploaded(false);
    }
  }, [fileSrc]);

  return (
    <NodeViewWrapper>
      <div className="relative group" data-drag-handle ref={fileComponentRef}>
        {(isUploaded || fileFromFileSystem) && !failedToLoad ? (
          <>
            <FileBlock
              editor={editor}
              fileFromFileSystem={fileFromFileSystem}
              getPos={getPos}
              node={node}
              selected={selected}
              setFailedToLoad={setFailedToLoad}
              updateAttributes={updateAttributes}
            />
            <FileToolbar
              editor={editor}
              fileHandler={fileHandler}
              node={node}
              editorContainer={editorContainer}
            />
          </>
        ) : (
          <FileUploader
            editor={editor}
            failedToLoad={failedToLoad}
            fileHandler={fileHandler}
            getPos={getPos}
            node={node}
            selected={selected}
            setFileFromFileSystem={setFileFromFileSystem}
            setIsUploaded={setIsUploaded}
            updateAttributes={updateAttributes}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}; 