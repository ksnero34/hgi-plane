import { useCallback, useState } from "react";
import { Editor } from "@tiptap/core";
// services
import { InstanceService } from "@/services/instance.service";
// ui
import { setToast } from "@plane/ui";

const instanceService = new InstanceService();

type TFileUploaderArgs = {
  editor: Editor;
  maxFileSize: number;
  onUpload: (url: string, file: File) => void;
};

export const useFileAttachmentUploader = (args: TFileUploaderArgs) => {
  const { editor, maxFileSize, onUpload } = args;
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      const setUploadInProgress = (isUploading: boolean) => {
        editor.storage.fileAttachment = editor.storage.fileAttachment || {};
        editor.storage.fileAttachment.uploadInProgress = isUploading;
      };

      setUploadInProgress(true);
      setUploading(true);

      try {
        // 파일 크기 검사
        if (file.size > maxFileSize) {
          throw new Error(`파일 크기는 ${Math.floor(maxFileSize / 1024 / 1024)}MB를 초과할 수 없습니다.`);
        }

        // 파일 업로드 명령 실행
        const url = await editor.commands.uploadFile(file);

        if (!url) {
          throw new Error("파일 업로드에 실패했습니다.");
        }

        onUpload(url, file);
      } catch (error: any) {
        console.error("파일 업로드 실패:", error);
        setToast({
          type: "error",
          title: "업로드 실패",
          message: error.message || "파일 업로드 중 오류가 발생했습니다."
        });
        throw error;
      } finally {
        setUploadInProgress(false);
        setUploading(false);
      }
    },
    [editor, maxFileSize, onUpload]
  );

  return { uploading, uploadFile };
};

type TFileDropzoneArgs = {
  editor: Editor;
  maxFileSize: number;
  onUpload: (url: string, file: File) => void;
};

export const useFileAttachmentDropzone = (args: TFileDropzoneArgs) => {
  const { editor, maxFileSize, onUpload } = args;
  const [isDragging, setIsDragging] = useState(false);
  const [draggedInside, setDraggedInside] = useState(false);

  const { uploadFile } = useFileAttachmentUploader({ editor, maxFileSize, onUpload });

  const validateFile = async (file: File) => {
    try {
      const fileSettings = await instanceService.getFileSettings();
      
      // 파일 크기 체크
      if (file.size > fileSettings.max_file_size) {
        setToast({
          type: "error",
          title: "파일 크기 초과",
          message: `파일 크기는 ${Math.floor(fileSettings.max_file_size / 1024 / 1024)}MB를 초과할 수 없습니다.`
        });
        return false;
      }

      // 파일 확장자 체크
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!fileExtension || !fileSettings.allowed_extensions.includes(fileExtension)) {
        setToast({
          type: "error",
          title: "지원하지 않는 파일 형식",
          message: `지원되는 파일 형식: ${fileSettings.allowed_extensions.join(', ')}`
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("파일 설정 가져오기 실패:", error);
      // 기본값 사용
      return file.size <= 5 * 1024 * 1024; // 5MB
    }
  };

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDraggedInside(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        const isValid = await validateFile(file);
        if (!isValid) return;

        try {
          await uploadFile(file);
        } catch (error) {
          console.error("파일 드롭 업로드 실패:", error);
        }
      }
    },
    [uploadFile]
  );

  const onDragEnter = useCallback(() => {
    setDraggedInside(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggedInside(false);
  }, []);

  return {
    isDragging,
    draggedInside,
    onDragEnter,
    onDragLeave,
    onDrop,
    uploadFile
  };
}; 