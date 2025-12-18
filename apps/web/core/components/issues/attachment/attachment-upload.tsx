import { MouseEvent, useCallback, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useDropzone } from "react-dropzone";
// plane web hooks
import { useFileSize } from "@/plane-web/hooks/use-file-size";
// constants
import { MAX_FILE_SIZE } from "@/constants/common";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
import { useFileValidation, ValidationResult } from "@/hooks/store/use-file-validation";
// ui
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// icons
import { Plus } from "lucide-react";
// types
import type { TAttachmentOperations } from "../issue-detail-widgets/attachments/helper";

type TAttachmentOperationsModal = Pick<TAttachmentOperations, "create">;

type Props = {
  workspaceSlug: string;
  disabled?: boolean;
  attachmentOperations: TAttachmentOperationsModal;
  validateFile: (file: File) => Promise<ValidationResult>;
};

export const IssueAttachmentUpload = observer(function IssueAttachmentUpload(props: Props) {
  const { workspaceSlug, disabled = false, attachmentOperations, validateFile } = props;
  // states
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  // store hooks
  const { fileSettings } = useInstance();
  const { getAcceptedFileTypes } = useFileValidation();
  // file size
  const { maxFileSize } = useFileSize();

  const effectiveMaxFileSize = useMemo(
    () => maxFileSize || fileSettings?.max_file_size || MAX_FILE_SIZE,
    [fileSettings?.max_file_size, maxFileSize]
  );

  const acceptedFileTypes = useMemo(() => getAcceptedFileTypes(), [getAcceptedFileTypes]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const currentFile: File = acceptedFiles[0];
      if (!currentFile || !workspaceSlug) return;

      try {
        const { isValid, error } = await validateFile(currentFile);

        if (!isValid) {
          setValidationError(error ?? "허용되지 않는 파일입니다.");
          return;
        }

        setValidationError(null);
        setIsLoading(true);
        await attachmentOperations.create(currentFile);

        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "업로드 성공",
          message: `${currentFile.name} 파일이 성공적으로 업로드되었습니다.`,
        });
      } catch (error) {
        console.error("IssueAttachmentUpload: failed to upload attachment", error);
        setValidationError("파일 업로드에 실패했습니다.");
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "업로드 실패",
          message: "파일 업로드 중 오류가 발생했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [attachmentOperations, validateFile, workspaceSlug]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open, fileRejections } = useDropzone({
    onDrop,
    maxSize: effectiveMaxFileSize,
    accept: acceptedFileTypes,
    multiple: false,
    disabled: isLoading || disabled,
    noClick: false,
    noKeyboard: false,
  });

  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    open();
  };

  const maxSizeInMB = Math.floor(effectiveMaxFileSize / (1024 * 1024));
  const fileError =
    validationError ||
    (fileRejections.length > 0
      ? `Invalid file type or size (max ${maxSizeInMB} MB)`
      : isDragReject
        ? `Invalid file type or size (max ${maxSizeInMB} MB)`
        : null);

  return (
    <div
      {...getRootProps()}
      className={`flex h-[60px] items-center justify-center rounded-md border-2 border-dashed bg-custom-background-90 transition-colors hover:bg-custom-background-80 ${
        isDragActive ? "border-custom-primary bg-custom-primary/10" : "border-custom-border-200"
      } ${isDragReject ? "bg-red-100" : ""} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input {...getInputProps()} />
      <button
        type="button"
        className="flex h-full w-full items-center justify-center"
        disabled={disabled || isLoading}
        onClick={handleOpen}
      >
        {isLoading ? (
          <span className="text-sm">Uploading...</span>
        ) : fileError ? (
          <span className="text-sm text-red-500">{fileError}</span>
        ) : isDragActive ? (
          <span className="text-sm">Drop here...</span>
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </button>
    </div>
  );
});
