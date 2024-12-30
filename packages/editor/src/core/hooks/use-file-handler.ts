import { DragEvent, useCallback, useState } from "react";
import { Editor } from "@tiptap/core";

type TFileHandlerArgs = {
  editor: Editor;
  maxFileSize?: number;
  allowedExtensions?: string[];
  onUpload: (url: string) => void;
};

type TFileDropzoneArgs = {
  editor: Editor;
  maxFileSize?: number;
  allowedExtensions?: string[];
  pos: number;
  uploader: (file: File) => Promise<void>;
};

const isFileValid = ({
  file,
  maxFileSize,
  allowedExtensions,
}: {
  file: File;
  maxFileSize: number;
  allowedExtensions: string[];
}) => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
    console.error(`허용되지 않는 파일 형식입니다. 허용된 확장자: ${allowedExtensions.join(', ')}`);
    return false;
  }

  if (file.size > maxFileSize) {
    console.error(`파일 크기가 너무 큽니다. 최대 크기: ${maxFileSize / (1024 * 1024)}MB`);
    return false;
  }

  return true;
};

export const useFileHandler = ({ editor, maxFileSize, allowedExtensions, onUpload }: TFileHandlerArgs) => {
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      if (maxFileSize && file.size > maxFileSize) {
        throw new Error(`파일 크기가 너무 큽니다. 최대 크기: ${maxFileSize / (1024 * 1024)}MB`);
      }

      if (allowedExtensions) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
          throw new Error(`허용되지 않는 파일 형식입니다. 허용된 확장자: ${allowedExtensions.join(', ')}, 선택한 파일 확장자: ${fileExtension}`);
        }
      }

      const uploadFn = editor.commands.uploadFile(file);
      const url = await uploadFn();
      if (!url) throw new Error("파일 업로드에 실패했습니다.");
      onUpload(url);
    } catch (error) {
      console.error("파일 업로드 중 오류 발생:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  }, [editor, onUpload, maxFileSize, allowedExtensions]);

  return { uploading, uploadFile };
};

export const useFileDropzone = ({ editor, maxFileSize, allowedExtensions, pos, uploader }: TFileDropzoneArgs) => {
  const [draggedInside, setDraggedInside] = useState(false);

  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setDraggedInside(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      await uploader(file);
    },
    [uploader]
  );

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDraggedInside(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggedInside(false);
  }, []);

  return {
    draggedInside,
    onDrop,
    onDragEnter,
    onDragLeave,
  };
}; 