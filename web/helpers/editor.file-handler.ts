import { TFileUploadHandler } from "@plane/editor";
import { FileService } from "@/services/file.service";
import { getFileURL } from "@/helpers/file.helper";

const fileService = new FileService();

type TFileHandlerArgs = {
  maxFileSize: number;
  projectId?: string;
  uploadFile: (file: File) => Promise<string>;
  workspaceId: string;
  workspaceSlug: string;
  allowedExtensions?: string[];
};

/**
 * @description 파일 업로드를 위한 에디터 파일 핸들러를 반환하는 함수
 * @param {TFileHandlerArgs} args
 */
export const getEditorFileUploadHandler = (args: TFileHandlerArgs): TFileUploadHandler => {
  const { maxFileSize, projectId, uploadFile, workspaceId, workspaceSlug, allowedExtensions } = args;

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
    delete: async (src: string) => {
      if (src?.startsWith("http")) {
        await fileService.deleteOldWorkspaceAsset(workspaceId, src);
      } else {
        await fileService.deleteNewAsset(await getAssetSrc(src));
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
    validateFile: async (file: File) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!fileExtension || !allowedExtensions?.includes(fileExtension)) {
        console.error(`Invalid file extension. Allowed: ${allowedExtensions?.join(', ')}`);
        return false;
      }

      if (file.size > maxFileSize) {
        console.error(`File too large. Max size: ${maxFileSize / (1024 * 1024)}MB`);
        return false;
      }

      return true;
    },
    validation: {
      maxFileSize,
      allowedExtensions,
    },
    workspaceSlug,
    projectId,
  };
}; 