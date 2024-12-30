import { TFileUploadHandler, TFileValidation } from "@plane/editor";
import { FileService } from "@/services/file.service";
import { getFileURL } from "@/helpers/file.helper";
import { useInstance } from "@/hooks/store";

const fileService = new FileService();

type TFileHandlerArgs = {
  maxFileSize: number;
  projectId?: string;
  uploadFile: (file: File) => Promise<string>;
  workspaceId: string;
  workspaceSlug: string;
};

/**
 * @description 파일 업로드를 위한 에디터 파일 핸들러를 반환하는 함수
 * @param {TFileHandlerArgs} args
 */
export const getEditorFileUploadHandler = (args: TFileHandlerArgs): TFileUploadHandler => {
  const { maxFileSize, projectId, uploadFile, workspaceId, workspaceSlug } = args;
  
  // 인스턴스 스토어에서 파일 설정 가져오기
  const { fileSettings } = useInstance();

  const getAssetSrc = async (path: string) => {
    if (!path) return "";
    if (path?.startsWith("http")) {
      return path;
    } else {
      return getFileURL(`/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/${path}`) ?? "";
    }
  };

  return {
    getAssetSrc,
    upload: uploadFile,
    delete: async (fileId: string) => {
      try {
        await fileService.deleteNewAsset(`/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/${fileId}/`);
      } catch (error) {
        console.error("Error deleting file:", error);
        throw error;
      }
    },
    restore: async (src: string) => {
      if (src?.startsWith("http")) {
        await fileService.restoreOldEditorAsset(workspaceId, src);
      } else {
        await fileService.restoreNewAsset(workspaceSlug, src);
      }
    },
    cancel: fileService.cancelUpload,
    validation: {
      maxFileSize: fileSettings?.max_file_size || maxFileSize,
      allowedExtensions: fileSettings?.allowed_extensions || [],
    },
  };
}; 