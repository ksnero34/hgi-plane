"use client";

import { useState, useEffect } from "react";
import { X, FileIcon, Trash2, ExternalLink } from "lucide-react";
// ui
import { Loader, setToast, TOAST_TYPE } from "@plane/ui";
// services
import { FileService } from "@/services/file.service";

const fileService = new FileService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  pageId: string;
  handleClose: () => void;
  isOpen: boolean;
  onFileUpload?: () => void;
};

export const PageFilesSidebarRoot: React.FC<Props> = (props) => {
  const { workspaceSlug, projectId, pageId, handleClose, isOpen, onFileUpload } = props;
  // states
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPageFiles = async () => {
    if (!workspaceSlug || !projectId || !pageId) return;

    setIsLoading(true);
    try {
      const response = await fileService.getPageFiles(workspaceSlug, projectId, pageId);
      setFiles(response || []);
    } catch (error) {
      console.error("파일 목록 조회 실패:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 목록 조회 실패",
        message: "파일 목록을 불러오는데 실패했습니다."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (assetId: string) => {
    try {
      await fileService.deleteFile(workspaceSlug, projectId, assetId);
      setFiles((prev) => prev.filter((file) => file.asset_id !== assetId));
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "파일 삭제 완료",
        message: "파일이 성공적으로 삭제되었습니다."
      });
    } catch (error) {
      console.error("파일 삭제 실패:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 삭제 실패",
        message: "파일 삭제 중 오류가 발생했습니다."
      });
    }
  };

  // 파일 업로드 이벤트 구독
  useEffect(() => {
    const handleFileUploadEvent = () => {
      console.log("📁 파일 업로드 이벤트 감지");
      fetchPageFiles();
    };

    window.addEventListener("file-uploaded", handleFileUploadEvent);
    return () => {
      window.removeEventListener("file-uploaded", handleFileUploadEvent);
    };
  }, [workspaceSlug, projectId, pageId]);

  // 초기 로딩 및 isOpen 변경 시 목록 갱신
  useEffect(() => {
    if (isOpen) {
      console.log("🔄 파일 목록 갱신");
      fetchPageFiles();
    }
  }, [isOpen, workspaceSlug, projectId, pageId]);

  return (
    <div className="flex-shrink-0 py-4 flex flex-col h-full">
      <div className="px-6 flex items-center justify-between gap-2">
        <h5 className="text-base font-semibold">첨부 파일</h5>
        <button
          type="button"
          onClick={handleClose}
          className="flex-shrink-0 size-6 grid place-items-center text-custom-text-300 hover:text-custom-text-100 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-4 px-4 flex-1 flex flex-col space-y-2 overflow-y-auto">
        {isLoading ? (
          <Loader className="space-y-4">
            <Loader.Item height="64px" />
            <Loader.Item height="64px" />
            <Loader.Item height="64px" />
          </Loader>
        ) : files.length > 0 ? (
          files.map((file) => (
            <div
              key={file.asset_id}
              className="p-3 rounded-lg border border-custom-border-200 bg-custom-background-100 hover:bg-custom-background-90"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 size-10 grid place-items-center rounded-lg bg-custom-background-90">
                  <FileIcon className="size-5 text-custom-text-200" />
                </div>
                <div className="flex-grow min-w-0">
                  <h6 className="text-sm font-medium text-custom-text-100 truncate">{file.name}</h6>
                  <p className="text-xs text-custom-text-200">{file.size}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(file.asset_url, "_blank")}
                    className="size-7 grid place-items-center rounded-md hover:bg-custom-background-80 text-custom-text-200 hover:text-custom-text-100"
                  >
                    <ExternalLink className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(file.asset_id)}
                    className="size-7 grid place-items-center rounded-md hover:bg-custom-background-80 text-custom-text-200 hover:text-red-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="h-full grid place-items-center">
            <div className="text-center">
              <FileIcon className="size-8 mx-auto text-custom-text-200" />
              <p className="mt-4 text-sm text-custom-text-200">
                아직 업로드된 파일이 없습니다.
                <br />
                파일 업로드 버튼을 클릭하여 파일을 추가해보세요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 