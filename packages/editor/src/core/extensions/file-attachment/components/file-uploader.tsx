import { ChangeEvent, useCallback, useEffect, useMemo, useRef } from "react";
import { FileIcon } from "lucide-react";
// hooks
import { useFileAttachmentUploader, useFileAttachmentDropzone } from "@/hooks/use-file-attachment-upload";
// helpers
import { cn } from "@/helpers/common";
// services
import { InstanceService } from "@/services/instance.service";
// ui
import { setToast } from "@plane/ui";
// types
import { TFileHandler } from "@/types";
import { getFileAttachmentFileMap } from "./index";
import { NodeViewProps } from "@tiptap/react";

const instanceService = new InstanceService();

type FileUploaderProps = NodeViewProps & {
  fileHandler: TFileHandler;
  failedToLoad: boolean;
  setFileFromFileSystem: (file: string) => void;
  setIsUploaded: (isUploaded: boolean) => void;
};

export const FileUploader = (props: FileUploaderProps) => {
  const {
    editor,
    fileHandler,
    node,
    getPos,
    updateAttributes,
    selected,
    failedToLoad,
    setFileFromFileSystem,
    setIsUploaded,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { id: fileId } = node.attrs;

  const onUpload = useCallback(
    (url: string, file: File) => {
      if (url) {
        updateAttributes({
          src: url,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileExtension: file.name.split('.').pop(),
          uploadedAt: new Date().toISOString(),
        });
        const fileAttachmentFileMap = getFileAttachmentFileMap(editor);
        fileAttachmentFileMap?.delete(fileId);
        setIsUploaded(true);
      }
    },
    [fileId, updateAttributes, editor, setIsUploaded]
  );

  const { uploading: isFileBeingUploaded, uploadFile } = useFileAttachmentUploader({
    editor,
    maxFileSize: fileHandler.validation.maxFileSize,
    onUpload,
  });

  const { draggedInside, onDrop, onDragEnter, onDragLeave } = useFileAttachmentDropzone({
    editor,
    maxFileSize: fileHandler.validation.maxFileSize,
    onUpload,
  });

  const meta = useMemo(
    () => getFileAttachmentFileMap(editor)?.get(fileId),
    [editor, fileId]
  );

  useEffect(() => {
    if (meta) {
      if (meta.event === "drop" && "file" in meta) {
        uploadFile(meta.file);
      } else if (meta.event === "insert" && fileInputRef.current && !meta.hasStartedUpload) {
        fileInputRef.current.click();
        getFileAttachmentFileMap(editor)?.set(fileId, { ...meta, hasStartedUpload: true });
      }
    }
  }, [meta, uploadFile, editor, fileId]);

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

  const onFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const isValid = await validateFile(file);
        if (!isValid) return;

        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            setFileFromFileSystem(reader.result as string);
          }
        };
        reader.readAsDataURL(file);
        await uploadFile(file);
      }
    },
    [uploadFile, setFileFromFileSystem]
  );

  const getDisplayMessage = useCallback(() => {
    if (failedToLoad) {
      return "파일을 불러오는데 실패했습니다";
    }

    if (isFileBeingUploaded) {
      return "업로드 중...";
    }

    if (draggedInside) {
      return "여기에 파일을 놓으세요";
    }

    return "파일 추가";
  }, [draggedInside, failedToLoad, isFileBeingUploaded]);

  return (
    <div
      className={cn(
        "file-upload-component flex items-center justify-start gap-2 py-3 px-2 rounded-lg text-custom-text-300 hover:text-custom-text-200 bg-custom-background-90 hover:bg-custom-background-80 border border-dashed border-custom-border-300 transition-all duration-200 ease-in-out cursor-default",
        {
          "hover:text-custom-text-200 cursor-pointer": editor.isEditable,
          "bg-custom-background-80 text-custom-text-200": draggedInside,
          "text-custom-primary-200 bg-custom-primary-100/10 hover:bg-custom-primary-100/10 hover:text-custom-primary-200 border-custom-primary-200/10":
            selected,
          "text-red-500 cursor-default hover:text-red-500": failedToLoad,
          "bg-red-500/10 hover:bg-red-500/10": failedToLoad && selected,
        }
      )}
      onDrop={onDrop}
      onDragOver={onDragEnter}
      onDragLeave={onDragLeave}
      contentEditable={false}
      onClick={() => {
        if (!failedToLoad && editor.isEditable) {
          fileInputRef.current?.click();
        }
      }}
    >
      <FileIcon className="size-4" />
      <div className="text-base font-medium">{getDisplayMessage()}</div>
      <input
        className="size-0 overflow-hidden"
        ref={fileInputRef}
        hidden
        type="file"
        accept="*/*"
        onChange={onFileChange}
      />
    </div>
  );
}; 