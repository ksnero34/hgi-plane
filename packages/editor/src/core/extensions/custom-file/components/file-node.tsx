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
    } catch (error: any) {
      console.error("Error deleting file:", error);
      const message = error?.response?.data?.message || error?.message || "파일 삭제에 실패했습니다.";
      updateAttributes({ 
        uploadStatus: "error",
        errorMessage: message
      });
      setFailedToLoadFile(true);
    }
  };

  const handleDownload = async () => {
    if (!fileId || !fileName) return;
    try {
      const fileHandler = editor.storage.customFile.fileHandler;
      if (!fileHandler.getAssetSrc) {
        throw new Error("getAssetSrc not available");
      }

      const url = await fileHandler.getAssetSrc(`${fileId}/`);
      if (!url) throw new Error("Failed to get file URL");

      // 파일 다운로드를 위한 임시 링크 생성
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;  // 원본 파일명 사용
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      const message = error?.message || "파일 다운로드에 실��했습니다.";
      updateAttributes({ 
        uploadStatus: "error",
        errorMessage: message
      });
      setFailedToLoadFile(true);
    }
  };

  return (
    <NodeViewWrapper as="div" className="relative group">
      <div
        contentEditable={false}
        draggable
        data-drag-handle
        className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab"
      >
        <div className="w-1 h-4 bg-custom-border-300 rounded" />
      </div>
      <div className="p-0 mx-0 my-2" ref={fileComponentRef}>
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