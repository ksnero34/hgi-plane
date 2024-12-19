import { useCallback, useState } from "react";
import { Editor } from "@tiptap/core";
// ui
import { setToast } from "@plane/ui";

type TFileUploaderArgs = {
  editor: Editor;
  onUpload: (url: string, file: File) => void;
};

export const useFileAttachmentUploader = (args: TFileUploaderArgs) => {
  const { editor, onUpload } = args;
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
    [editor, onUpload]
  );

  return { uploading, uploadFile };
};

type TFileDropzoneArgs = {
  editor: Editor;
  onUpload: (url: string, file: File) => void;
};

export const useFileAttachmentDropzone = (args: TFileDropzoneArgs) => {
  const { editor, onUpload } = args;
  const [isDragging, setIsDragging] = useState(false);
  const [draggedInside, setDraggedInside] = useState(false);

  const { uploadFile } = useFileAttachmentUploader({ editor, onUpload });

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDraggedInside(false);

      const file = e.dataTransfer.files[0];
      if (file) {
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