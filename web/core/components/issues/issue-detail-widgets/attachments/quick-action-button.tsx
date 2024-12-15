"use client";

import React, { FC, useCallback, useState } from "react";
import { observer } from "mobx-react";
import { FileRejection, useDropzone } from "react-dropzone";
import { Plus } from "lucide-react";
// plane ui
import { TOAST_TYPE, setToast } from "@plane/ui";
// hooks
import { useIssueDetail } from "@/hooks/store";
// plane web hooks
import { useFileSize } from "@/plane-web/hooks/use-file-size";
import { useAttachmentOperations } from "./helper";

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
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      const totalAttachedFiles = acceptedFiles.length + rejectedFiles.length;

      if (rejectedFiles.length === 0) {
        const currentFile: File = acceptedFiles[0];
        if (!currentFile || !workspaceSlug) return;

        setIsLoading(true);
        attachmentOperations
          .create(currentFile)
          .catch((error: any) => {
            console.error("Upload error:", error);
            let errorMessage = "파일 업로드 중 오류가 발생했습니다.";
            
            // 서버 에러 응답 처리
            if (error?.serverError?.error) {
              errorMessage = error.serverError.error;
            } else if (error?.message) {
              errorMessage = error.message;
            }

            setToast({
              type: TOAST_TYPE.ERROR,
              title: "업로드 실패",
              message: errorMessage,
            });
          })
          .finally(() => {
            handleFetchPropertyActivities();
            setLastWidgetAction("attachments");
            setIsLoading(false);
          });
        return;
      }

      setToast({
        type: TOAST_TYPE.ERROR,
        title: "업로드 실패",
        message:
          totalAttachedFiles > 1
            ? "한 번에 하나의 파일만 업로드할 수 있습니다."
            : `파일 크기는 ${maxFileSize / 1024 / 1024}MB 이하여야 합니다.`,
      });
      return;
    },
    [attachmentOperations, maxFileSize, workspaceSlug, handleFetchPropertyActivities, setLastWidgetAction]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    maxSize: maxFileSize,
    multiple: false,
    disabled: isLoading || disabled,
  });

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <button {...getRootProps()} type="button" disabled={disabled}>
        <input {...getInputProps()} />
        {customButton ? customButton : <Plus className="h-4 w-4" />}
      </button>
    </div>
  );
});