import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { CustomBaseFileNodeViewProps } from "../custom-file";
import { FileBlock } from "./file-block";
import { FileUploader } from "./file-uploader";
import { FileDeleteConfirmModal } from "./file-delete-confirm-modal";

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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const handleDeleteClick = async (): Promise<void> => {
    // 삭제 버튼 클릭 시 모달 열기
    setIsDeleteModalOpen(true);
    return Promise.resolve();
  };

  const handleDeleteConfirm = async () => {
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
        errorMessage: message,
      });
      setFailedToLoadFile(true);
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
  };

  const handleDownload = async () => {
    if (!fileId || !fileName) return;
    try {
      let url = "";

      // 각 모드에 맞는 fileHandler 찾기
      let fileHandler;

      try {
        // customFile 스토리지에서 fileHandler 가져오기
        if (editor.storage.customFile?.fileHandler?.getAssetSrc) {
          fileHandler = editor.storage.customFile.fileHandler;
          url = await fileHandler.getAssetSrc(`${fileId}/`);
          console.log(`[FileDownload] Generated URL: ${url}`);
          console.log(`[FileDownload] FileID: ${fileId}, FileName: ${fileName}`);
        }
      } catch (fetchError) {
        console.error("Error fetching file URL:", fetchError);
      }

      // URL을 가져오지 못한 경우
      if (!url) {
        throw new Error("파일 URL을 가져오지 못했습니다");
      }

      // 먼저 getAssetDownloadSrc가 있는지 확인하고 사용
      try {
        console.log(`[FileDownload] Checking getAssetDownloadSrc:`, !!fileHandler?.getAssetDownloadSrc);
        if (fileHandler?.getAssetDownloadSrc) {
          console.log(`[FileDownload] Calling getAssetDownloadSrc with: ${fileId}/`);
          const downloadUrl = await fileHandler.getAssetDownloadSrc(`${fileId}/`);
          console.log(`[FileDownload] Download URL: ${downloadUrl}`);
          if (downloadUrl) {
            url = downloadUrl;
          }
        } else {
          console.log(`[FileDownload] getAssetDownloadSrc not available, using asset URL`);
        }
      } catch (downloadError) {
        console.warn("Download URL generation failed, using asset URL:", downloadError);
      }

      // 파일 다운로드를 위한 임시 링크 생성
      const link = document.createElement("a");
      link.href = url;
      // HTML5 download 속성 제거 - 서버의 Content-Disposition 헤더에 의존
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log(`[FileDownload] Download initiated: ${fileName} from ${url}`);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      const message = error?.message || "파일 다운로드에 실패했습니다.";
      updateAttributes({
        uploadStatus: "error",
        errorMessage: message,
      });
      setFailedToLoadFile(true);
    }
  };

  return (
    <>
      <NodeViewWrapper as="div" className="relative group">
        <div className="p-0 mx-0 my-2" ref={fileComponentRef}>
          {isUploaded && !failedToLoadFile ? (
            <FileBlock
              {...props}
              editorContainer={editorContainer}
              onDelete={handleDeleteClick}
              onDownload={handleDownload}
              setFailedToLoadFile={setFailedToLoadFile}
            />
          ) : editor.isEditable ? (
            <FileUploader {...props} setIsUploaded={setIsUploaded} setFailedToLoadFile={setFailedToLoadFile} />
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

      {/* 파일 삭제 확인 모달 */}
      {isDeleteModalOpen && (
        <FileDeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          fileName={fileName}
        />
      )}
    </>
  );
};
