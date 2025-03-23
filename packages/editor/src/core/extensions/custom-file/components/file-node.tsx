import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { CustomBaseFileNodeViewProps } from "../custom-file";
import { FileBlock } from "./file-block";
import { FileUploader } from "./file-uploader";

export const FileNode = (props: CustomBaseFileNodeViewProps) => {
  const { node, editor, getPos, updateAttributes } = props;
  
  // 속성을 안전하게 추출 (id와 fileId 둘 다 지원)
  const fileId = node.attrs.id || node.attrs.fileId;
  const fileName = node.attrs.fileName;
  const uploadStatus = node.attrs.uploadStatus || "success";

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
    // 편집 모드가 아니면 삭제 불가능
    if (!editor.isEditable) return;
    
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
      let url = "";

      // 각 모드에 맞는 fileHandler 찾기
      let fileHandler;
      
      try {
        // 1. 읽기 모드(fileComponent)에서 시도
        if (editor.storage.fileComponent?.fileHandler?.getAssetSrc) {
          fileHandler = editor.storage.fileComponent.fileHandler;
          url = await fileHandler.getAssetSrc(`${fileId}/`);
        }
        // 2. 실패하면 편집 모드(customFile)에서 시도
        else if (editor.storage.customFile?.fileHandler?.getAssetSrc) {
          fileHandler = editor.storage.customFile.fileHandler;
          url = await fileHandler.getAssetSrc(`${fileId}/`);
        }
      } catch (fetchError) {
        console.error("Error fetching file URL:", fetchError);
      }

      // URL을 가져오지 못한 경우
      if (!url) {
        throw new Error("파일 URL을 가져오지 못했습니다");
      }

      // 파일 다운로드를 위한 임시 링크 생성
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      const message = error?.message || "파일 다운로드에 실패했습니다.";
      updateAttributes({ 
        uploadStatus: "error",
        errorMessage: message
      });
      setFailedToLoadFile(true);
    }
  };

  return (
    <NodeViewWrapper as="div" className="relative group">
      <div className="p-0 mx-0 my-2" ref={fileComponentRef}>
        {isUploaded && !failedToLoadFile ? (
          <FileBlock
            {...props}
            editorContainer={editorContainer}
            onDelete={handleDelete}
            onDownload={handleDownload}
            setFailedToLoadFile={setFailedToLoadFile}
          />
        ) : editor.isEditable ? (
          <FileUploader
            {...props}
            setIsUploaded={setIsUploaded}
            setFailedToLoadFile={setFailedToLoadFile}
          />
        ) : (
          // 읽기 모드에서 업로드 실패/진행 중인 경우 간단한 메시지 표시
          <div className="p-3 border rounded-md bg-custom-background-100">
            <div className="text-sm text-custom-text-200">
              {failedToLoadFile ? "파일을 불러올 수 없습니다." : "파일 업로드 중..."}
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}; 