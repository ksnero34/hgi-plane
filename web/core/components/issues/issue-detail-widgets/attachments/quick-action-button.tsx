"use client";

import React, { FC, useCallback, useState } from "react";
import { observer } from "mobx-react";
import { useDropzone, FileRejection } from "react-dropzone";
import { Plus } from "lucide-react";
// hooks
import { useInstance, useIssueDetail, useFileValidation } from "@/hooks/store";
import { validateFileBeforeUpload } from "@/components/issues/attachment/helper";
// plane ui
// hooks
// plane web hooks
import { useFileSize } from "@/plane-web/hooks/use-file-size";

import { useAttachmentOperations } from "./helper";
// helpers
import { generateFileName } from "@/helpers/attachment.helper";
import { MAX_FILE_SIZE } from "@/constants/common";
import { TOAST_TYPE, setToast } from "@plane/ui";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  customButton?: React.ReactNode;
  disabled?: boolean;
};

export const IssueAttachmentActionButton: FC<Props> = observer((props) => {
  const { workspaceSlug, projectId, issueId, customButton, disabled = false } = props;
  // state
  const [isLoading, setIsLoading] = useState(false);
  // store hooks
  const { config, fileSettings, fetchFileSettings } = useInstance();

  const { validateFile, getAcceptedFileTypes } = useFileValidation();

  const { setLastWidgetAction, fetchActivities } = useIssueDetail();
  // file size
  const { maxFileSize } = useFileSize();
  // operations
  const { operations: attachmentOperations } = useAttachmentOperations(workspaceSlug, projectId, issueId);
  // handlers
  const handleFetchPropertyActivities = useCallback(() => {
    fetchActivities(workspaceSlug, projectId, issueId);
  }, [fetchActivities, workspaceSlug, projectId, issueId]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      console.log("🎯 onDrop triggered with files:", acceptedFiles);
      
      // 파일 선택 시 최신 설정 가져오기
      try {
        await fetchFileSettings();
      } catch (error) {
        console.error("Failed to fetch latest file settings:", error);
      }
      
      const currentFile: File = acceptedFiles[0];
      
      if (!currentFile || !workspaceSlug) {
        console.log("❌ No file or workspace slug", { currentFile, workspaceSlug });
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
          setLastWidgetAction("attachments");
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
          console.log("🏁 Upload process completed");
          setIsLoading(false);
        });
    },
    [handleAttachmentOperations, workspaceSlug, validateFile, setLastWidgetAction, fetchFileSettings]
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

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    onDropRejected,
    maxSize: fileSettings?.max_file_size ?? MAX_FILE_SIZE,
    multiple: false,
    disabled: isLoading || disabled,
    accept: getAcceptedFileTypes(),
    noClick: true,
  });

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("🔘 Upload button clicked");
    console.log("Current state:", { isLoading, disabled });
    console.log("Current file settings:", fileSettings);
    open();
  };

  return (
    <div {...getRootProps()} className="relative" onClick={(e) => e.stopPropagation()}>
      <input {...getInputProps()} />
      <button 
        type="button" 
        onClick={handleButtonClick}
        disabled={disabled || isLoading}
        className={`flex items-center justify-center p-1 hover:bg-custom-background-80 rounded transition-colors ${
          disabled || isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
      >
        {customButton ? customButton : <Plus className="h-4 w-4" />}
      </button>
    </div>
  );
});
