import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { CustomBaseFileNodeViewProps } from "../custom-file";
import { FileBlock } from "./file-block";
import { FileUploader } from "./file-uploader";

export const FileNode = (props: CustomBaseFileNodeViewProps) => {
  const { node, editor, getPos, updateAttributes } = props;
  const { id: fileId, uploadStatus, fileName } = node.attrs;

  const [isUploaded, setIsUploaded] = useState(uploadStatus === "success");
  const [failedToLoadFile, setFailedToLoadFile] = useState(uploadStatus === "error");
  const [editorContainer, setEditorContainer] = useState<HTMLDivElement | null>(null);
  const fileComponentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closestEditorContainer = fileComponentRef.current?.closest(".editor-container");
    if (closestEditorContainer) {
      setEditorContainer(closestEditorContainer as HTMLDivElement);
    }
  }, []);

  useEffect(() => {
    setIsUploaded(uploadStatus === "success");
    setFailedToLoadFile(uploadStatus === "error");
  }, [uploadStatus]);

  const handleDelete = async () => {
    try {
      const pos = getPos();
      await editor.commands.deleteFile(fileId);
      editor.commands.deleteRange({ from: pos, to: pos + 1 });
    } catch (error) {
      console.error("Error deleting file:", error);
      const pos = getPos();
      editor.commands.deleteRange({ from: pos, to: pos + 1 });
    }
  };

  const handleDownload = async () => {
    if (!fileName) return;
    try {
      const link = document.createElement("a");
      link.href = fileName;
      link.download = fileName.split("/").pop() || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  return (
    <NodeViewWrapper>
      <div className="p-0 mx-0 my-2" data-drag-handle ref={fileComponentRef}>
        {isUploaded && !failedToLoadFile ? (
          <FileBlock
            {...props}
            editorContainer={editorContainer}
            onDelete={handleDelete}
            onDownload={handleDownload}
            setFailedToLoadFile={setFailedToLoadFile}
          />
        ) : (
          <FileUploader
            {...props}
            setIsUploaded={setIsUploaded}
            setFailedToLoadFile={setFailedToLoadFile}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}; 