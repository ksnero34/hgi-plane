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
    console.error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
    return false;
  }

  if (file.size > maxFileSize) {
    console.error(`File too large. Max size: ${maxFileSize / (1024 * 1024)}MB`);
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
        throw new Error(`File too large. Max size: ${maxFileSize / (1024 * 1024)}MB`);
      }

      if (allowedExtensions) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
          throw new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
        }
      }

      const uploadFn = editor.commands.uploadFile(file);
      const url = await uploadFn();
      if (!url) throw new Error("Failed to upload file");
      onUpload(url);
    } catch (error) {
      console.error("Error uploading file:", error);
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