import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { useDropzone } from "react-dropzone";
// constants
import { MAX_FILE_SIZE } from "@/constants/common";
// helpers
import { generateFileName } from "@/helpers/attachment.helper";
// hooks
import { useInstance, useFileValidation } from "@/hooks/store";
// types
import { TAttachmentOperations } from "./root";

type TAttachmentOperationsModal = Exclude<TAttachmentOperations, "remove">;

type Props = {
  workspaceSlug: string;
  disabled?: boolean;
  handleAttachmentOperations: TAttachmentOperationsModal;
};

export const IssueAttachmentUpload: React.FC<Props> = observer((props) => {
  const { workspaceSlug, disabled = false, handleAttachmentOperations } = props;
  
  // store hooks
  const { config, fileSettings } = useInstance();
  const { validateFile, getAcceptedFileTypes } = useFileValidation();
  
  // states
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const currentFile: File = acceptedFiles[0];
      console.log("📁 Dropped file:", {
        name: currentFile?.name,
        size: currentFile?.size,
        type: currentFile?.type
      });

      if (!currentFile || !workspaceSlug) {
        console.log("❌ No file or workspace slug");
        return;
      }

      // 파일 검증
      console.log("🔍 Validating file with settings:", {
        maxFileSize: fileSettings?.max_file_size,
        allowedExtensions: fileSettings?.allowed_extensions
      });

      const { isValid, error } = validateFile(currentFile);
      console.log("✅ Validation result:", { isValid, error });

      if (!isValid) {
        console.log("❌ Validation failed:", error);
        setValidationError(error);
        return;
      }
      setValidationError(null);

      const uploadedFile: File = new File([currentFile], generateFileName(currentFile.name), {
        type: currentFile.type,
      });
      console.log("📝 Prepared file for upload:", {
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.type
      });
      
      const formData = new FormData();
      formData.append("asset", uploadedFile);
      formData.append(
        "attributes",
        JSON.stringify({
          name: uploadedFile.name,
          size: uploadedFile.size,
        })
      );
      
      console.log("🚀 Starting upload...");
      setIsLoading(true);
      handleAttachmentOperations.create(formData)
        .then(() => {
          console.log("✅ Upload successful");
        })
        .catch((error) => {
          console.error("❌ Upload failed:", error);
        })
        .finally(() => {
          console.log("🏁 Upload process completed");
          setIsLoading(false);
        });
    },
    [handleAttachmentOperations, workspaceSlug, validateFile, fileSettings]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    maxSize: config?.file_size_limit ?? MAX_FILE_SIZE,
    multiple: false,
    disabled: isLoading || disabled,
    accept: getAcceptedFileTypes(),
  });

  console.log("📋 Current dropzone state:", {
    isDragActive,
    isDragReject,
    fileRejections,
    acceptedTypes: getAcceptedFileTypes()
  });

  const fileError = validationError || 
    (fileRejections.length > 0 ? `Invalid file type or size (max ${(fileSettings?.max_file_size ?? MAX_FILE_SIZE) / 1024 / 1024} MB)` : null);

  return (
    <div
      {...getRootProps()}
      className={`flex h-[60px] items-center justify-center rounded-md border-2 border-dashed bg-custom-primary/5 px-4 text-xs text-custom-primary ${
        isDragActive ? "border-custom-primary bg-custom-primary/10" : "border-custom-border-200"
      } ${isDragReject ? "bg-red-100" : ""} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <input {...getInputProps()} />
      <span className="flex items-center gap-2">
        {isDragActive ? (
          <p>Drop here...</p>
        ) : fileError ? (
          <p className="text-center text-red-500">{fileError}</p>
        ) : isLoading ? (
          <p className="text-center">Uploading...</p>
        ) : (
          <p className="text-center">Click or drag a file here</p>
        )}
      </span>
    </div>
  );
});
