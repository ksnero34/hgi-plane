import { useCallback, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useDropzone } from "react-dropzone";
// constants
import { MAX_FILE_SIZE } from "@/constants/common";
// helpers
import { generateFileName } from "@/helpers/attachment.helper";
// hooks
import { useInstance, useFileValidation } from "@/hooks/store";
// icons
import { Plus } from "lucide-react";
// types
import { TAttachmentOperations } from "../issue-detail-widgets/attachments/helper";

type TAttachmentOperationsModal = Pick<TAttachmentOperations, "create">;

type Props = {
  workspaceSlug: string;
  disabled?: boolean;
  attachmentOperations: TAttachmentOperationsModal;
};

export const IssueAttachmentUpload: React.FC<Props> = observer((props) => {
  const { workspaceSlug, disabled = false, handleAttachmentOperations } = props;
  
  // store hooks
  const { config, fileSettings, fetchFileSettings } = useInstance();
  const { validateFile, getAcceptedFileTypes } = useFileValidation();
  
  // states
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 컴포넌트 마운트 시 file settings 가져오기
  useEffect(() => {
    fetchFileSettings().catch(console.error);
  }, [fetchFileSettings]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // 파일 업로드 전 최신 설정 가져오기
      try {
        await fetchFileSettings();
      } catch (error) {
        console.error("Failed to fetch latest file settings:", error);
      }

      const currentFile: File = acceptedFiles[0];
      
      // 파일이 없는 경우 체크
      if (!currentFile) {
        // console.log("❌ No file selected");
        return;
      }

      if (!workspaceSlug) {
        // console.log("❌ No workspace slug");
        return;
      }

      // console.log("📁 Processing file:", {
      //   name: currentFile.name,
      //   size: currentFile.size,
      //   type: currentFile.type
      // });

      // 파일 검증
      const { isValid, error } = validateFile(currentFile);
      if (!isValid) {
        // console.log("❌ Validation failed:", error);
        setValidationError(error);
        return;
      }
      setValidationError(null);

      // 파일 이름 생성 및 새 File 객체 생성
      const uploadedFile: File = new File([currentFile], generateFileName(currentFile.name), {
        type: currentFile.type,
      });

      // FormData 생성
      const formData = new FormData();
      formData.append("asset", uploadedFile);
      formData.append(
        "attributes",
        JSON.stringify({
          name: uploadedFile.name,
          size: uploadedFile.size,
        })
      );
      
      // 업로드 시작
      console.log("🚀 Starting upload process");
      setIsLoading(true);
      
      handleAttachmentOperations.create(formData)
        .then(() => {
          console.log("✅ Upload completed successfully");
          setValidationError(null);
        })
        .catch((error) => {
          console.error("❌ Upload failed:", error);
          setValidationError("파일 업로드에 실패했습니다.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [handleAttachmentOperations, workspaceSlug, validateFile, fetchFileSettings]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    maxSize: maxFileSize,
    multiple: false,
    disabled: isLoading || disabled,
    accept: getAcceptedFileTypes(),
    noClick: false,
    noKeyboard: false,
  });

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
        onClick={open}  // 버튼 클릭 시 파일 선택 다이얼로그 열기
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
