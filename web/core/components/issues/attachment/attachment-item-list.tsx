import { FC, useCallback, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useDropzone, FileRejection } from "react-dropzone";
import { UploadCloud } from "lucide-react";
// hooks
import { useInstance, useIssueDetail, useFileValidation } from "@/hooks/store";
import { validateFileBeforeUpload } from "@/components/issues/attachment/helper";
import { TOAST_TYPE, setToast } from "@plane/ui";
// components
import { IssueAttachmentsListItem } from "./attachment-list-item";
import { IssueAttachmentDeleteModal } from "./delete-attachment-modal";
import { TAttachmentOperations } from "./root";
import { generateFileName } from "@/helpers/attachment.helper";

type TAttachmentOperationsRemoveModal = Exclude<TAttachmentOperations, "create">;

type TIssueAttachmentItemList = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  attachmentHelpers: TAttachmentHelpers;
  disabled?: boolean;
};

export const IssueAttachmentItemList: FC<TIssueAttachmentItemList> = observer((props) => {
  const { workspaceSlug, projectId, issueId, attachmentHelpers, disabled } = props;
  // states
  const [isUploading, setIsUploading] = useState(false);
  // store hooks
  const { config, fileSettings, fetchFileSettings } = useInstance();
  const { validateFile, getAcceptedFileTypes } = useFileValidation();
  const {
    attachment: { getAttachmentsByIssueId },
    attachmentDeleteModalId,
    toggleDeleteAttachmentModal,
    fetchActivities,
  } = useIssueDetail();

  // derived values
  const issueAttachments = getAttachmentsByIssueId(issueId);

  // 컴포넌트 마운트 시 file settings 가져오기
  useEffect(() => {
    fetchFileSettings().catch(console.error);
  }, [fetchFileSettings]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      console.log("🎯 onDrop triggered with files:", acceptedFiles);
      
      try {
        await fetchFileSettings();
      } catch (error) {
        console.error("Failed to fetch latest file settings:", error);
      }
      
      const currentFile: File = acceptedFiles[0];
      
      if (!currentFile || !workspaceSlug) {
        console.log("❌ No file or workspace slug");
        return;
      }

      console.log("📁 Processing file:", {
        name: currentFile.name,
        size: currentFile.size,
        type: currentFile.type
      });

      if (!validateFileBeforeUpload(currentFile, validateFile)) {
        console.log("❌ File validation failed");
        return;
      }

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

      console.log("🚀 Starting upload process");
      setIsLoading(true);
      handleAttachmentOperations.create(formData)
        .then(() => {
          console.log("✅ Upload successful");
        })
        .catch((error: any) => {
          console.error("❌ Upload failed:", error);
          // 서버 에러 응답 처리
          if (error.response?.data?.error) {
            setToast({
              type: TOAST_TYPE.ERROR,
              title: "파일 업로드 실패",
              message: error.response.data.error
            });
          } else {
            setToast({
              type: TOAST_TYPE.ERROR,
              title: "파일 업로드 실패",
              message: "파일을 업로드하는 중 오류가 발생했습니다."
            });
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [handleAttachmentOperations, workspaceSlug, validateFile, fetchFileSettings]
  );

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    console.log("❌ File rejected:", fileRejections);
    const [rejection] = fileRejections;
    if (rejection) {
      const errorMessage = rejection.errors[0]?.message || "파일이 거부되었습니다.";
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 업로드 실패",
        message: errorMessage
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    maxSize: fileSettings?.max_file_size ?? config?.file_size_limit,
    multiple: false,
    disabled: isLoading || disabled,
    accept: getAcceptedFileTypes(),
    noClick: false,
    noKeyboard: false,
  });

  return (
    <>
      {attachmentDeleteModalId && (
        <IssueAttachmentDeleteModal
          isOpen={Boolean(attachmentDeleteModalId)}
          onClose={() => toggleDeleteAttachmentModal(null)}
          handleAttachmentOperations={handleAttachmentOperations}
          attachmentId={attachmentDeleteModalId}
        />
      )}
      <div
        {...getRootProps()}
        className={`relative flex flex-col ${isDragActive && issueAttachments.length < 3 ? "min-h-[200px]" : ""} ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="absolute flex items-center justify-center left-0 top-0 h-full w-full bg-custom-background-90/75 z-30">
            <div className="flex items-center justify-center p-1 rounded-md bg-custom-background-100">
              <div className="flex flex-col justify-center items-center px-5 py-6 rounded-md border border-dashed border-custom-border-300">
                <UploadCloud className="size-7" />
                <span className="text-sm text-custom-text-300">Drag and drop anywhere to upload</span>
              </div>
            )}
            {issueAttachments?.map((attachmentId) => (
              <IssueAttachmentsListItem key={attachmentId} attachmentId={attachmentId} disabled={disabled} />
            ))}
          </div>
        </>
      )}
    </>
  );
});
