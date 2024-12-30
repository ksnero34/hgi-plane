import { useCallback, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useDropzone } from "react-dropzone";
// constants
import { MAX_FILE_SIZE } from "@/constants/common";
// helpers
import { generateFileName } from "@/helpers/attachment.helper";
// hooks
import { useInstance, useFileValidation, ValidationResult } from "@/hooks/store";
// icons
import { Plus } from "lucide-react";
// types
import { TAttachmentOperations } from "../issue-detail-widgets/attachments/helper";

type TAttachmentOperationsModal = Pick<TAttachmentOperations, "create">;

type Props = {
  workspaceSlug: string;
  disabled?: boolean;
  attachmentOperations: TAttachmentOperationsModal;
  validateFile: (file: File) => Promise<ValidationResult>;
};

export const IssueAttachmentUpload: React.FC<Props> = observer((props) => {
  const { workspaceSlug, disabled = false, attachmentOperations, validateFile } = props;
  
  // store hooks
  const { config, fileSettings, fetchFileSettings } = useInstance();
  const { getAcceptedFileTypes } = useFileValidation();
  
  // states
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 컴포넌트 마운트 시 file settings 가져오기
  useEffect(() => {
    fetchFileSettings().catch(console.error);
  }, [fetchFileSettings]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const currentFile: File = acceptedFiles[0];
      
      if (!currentFile || !workspaceSlug) return;

      try {
        const validationResult = await validateFile(currentFile);
        if (!validationResult.isValid) {
          setValidationError(validationResult.error);
          return;
        }
        setValidationError(null);

        setIsLoading(true);
        await attachmentOperations.create(currentFile);
        setValidationError(null);
      } catch (error) {
        console.error("❌ Upload failed:", error);
        setValidationError("파일 업로드에 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [attachmentOperations, workspaceSlug, validateFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isLoading || disabled,
    noClick: false,
    noKeyboard: false,
  });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    open();
  };

  const fileError = validationError || 
    (isDragReject ? `Invalid file type or size (max ${(fileSettings?.max_file_size ?? MAX_FILE_SIZE) / 1024 / 1024} MB)` : null);

  return (
    <div
      {...getRootProps()}
      className={`flex h-[60px] items-center justify-center rounded-md border-2 border-dashed bg-custom-background-90 hover:bg-custom-background-80 ${
        isDragActive ? "border-custom-primary bg-custom-primary/10" : "border-custom-border-200"
      } ${isDragReject ? "bg-red-100" : ""} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input {...getInputProps()} />
      <button
        type="button"
        className="flex items-center justify-center w-full h-full"
        disabled={disabled || isLoading}
        onClick={handleClick}
      >
        {isLoading ? (
          <span className="text-sm">Uploading...</span>
        ) : fileError ? (
          <span className="text-sm text-red-500">{fileError}</span>
        ) : (
          <Plus className="w-4 h-4" />
        )}
      </button>
    </div>
  );
});
