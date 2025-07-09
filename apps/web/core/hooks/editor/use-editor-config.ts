import { useCallback } from "react";
// plane editor
import { TFileHandler, TReadOnlyFileHandler } from "@plane/editor";
// helpers
import { getEditorAssetSrc } from "@/helpers/editor.helper";
// hooks
import { useEditorAsset } from "@/hooks/store";
// plane web hooks
import { useFileSize } from "@/plane-web/hooks/use-file-size";
// services
import { FileService } from "@/services/file.service";
const fileService = new FileService();

type TArgs = {
  projectId?: string;
  uploadFile: TFileHandler["upload"];
  workspaceId: string;
  workspaceSlug: string;
};

export const useEditorConfig = () => {
  // store hooks
  const { assetsUploadPercentage } = useEditorAsset();
  // file size
  const { maxFileSize } = useFileSize();

  const getReadOnlyEditorFileHandlers = useCallback(
    (args: Pick<TArgs, "projectId" | "workspaceId" | "workspaceSlug">): TReadOnlyFileHandler & { validateFile?: (file: File) => Promise<boolean>; fileTypes?: string[]; maxFileSize?: number } => {
      const { projectId, workspaceId, workspaceSlug } = args;

      return {
        checkIfAssetExists: async (assetId: string) => {
          const res = await fileService.checkIfAssetExists(workspaceSlug, assetId);
          return res?.exists ?? false;
        },
        getAssetSrc: async (path) => {
          if (!path) return "";
          if (path?.startsWith("http")) {
            // console.log("[getReadOnlyEditorFileHandlers] Returning direct URL:", path);
            return path;
          } else {
            const assetSrc = getEditorAssetSrc({
              assetId: path,
              projectId,
              workspaceSlug,
            }) ?? "";
            // console.log("[getReadOnlyEditorFileHandlers] Generated asset src:", assetSrc);
            return assetSrc;
          }
        },
        restore: async (src: string) => {
          // console.log("[getReadOnlyEditorFileHandlers] restore called with:", src);
          if (src?.startsWith("http")) {
            await fileService.restoreOldEditorAsset(workspaceId, src);
          } else {
            await fileService.restoreNewAsset(workspaceSlug, src);
          }
        },
        // 파일 핸들러에 필요한 추가 속성들
        validateFile: async (file: File) => {
          // console.log("[getReadOnlyEditorFileHandlers] validateFile called with:", file.name);
          return true;
        },
        fileTypes: ["*"],
        maxFileSize: 50 * 1024 * 1024, // 50MB
      };
    },
    []
  );

  const getEditorFileHandlers = useCallback(
    (args: TArgs): TFileHandler => {
      const { projectId, uploadFile, workspaceId, workspaceSlug } = args;

      return {
        ...getReadOnlyEditorFileHandlers({
          projectId,
          workspaceId,
          workspaceSlug,
        }),
        assetsUploadStatus: assetsUploadPercentage,
        upload: uploadFile,
        delete: async (src: string) => {
          if (src?.startsWith("http")) {
            await fileService.deleteOldWorkspaceAsset(workspaceId, src);
          } else {
            await fileService.deleteNewAsset(
              getEditorAssetSrc({
                assetId: src,
                projectId,
                workspaceSlug,
              }) ?? ""
            );
          }
        },
        cancel: fileService.cancelUpload,
        validation: {
          maxFileSize,
        },
      };
    },
    [assetsUploadPercentage, getReadOnlyEditorFileHandlers, maxFileSize]
  );

  return {
    getEditorFileHandlers,
    getReadOnlyEditorFileHandlers,
  };
};
