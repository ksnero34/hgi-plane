import type { FC } from "react";
import React, { useCallback, useState } from "react";
import { observer } from "mobx-react";
import type { FileRejection } from "react-dropzone";
import { useDropzone } from "react-dropzone";
import { Plus } from "lucide-react";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIssueServiceType } from "@plane/types";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useFileValidation } from "@/hooks/store/use-file-validation";
// plane web hooks
import { useFileSize } from "@/plane-web/hooks/use-file-size";
// local imports
import { useAttachmentOperations } from "./helper";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  customButton?: React.ReactNode;
  disabled?: boolean;
  issueServiceType: TIssueServiceType;
};

export const IssueAttachmentActionButton = observer(function IssueAttachmentActionButton(props: Props) {
  const { workspaceSlug, projectId, issueId, customButton, disabled = false, issueServiceType } = props;
  // state
  const [isLoading, setIsLoading] = useState(false);
  // store hooks
  // const { setLastWidgetAction, fetchActivities } = useIssueDetail();
  // validation hooks
  const { validateFile } = useFileValidation();
  const { setLastWidgetAction, fetchActivities } = useIssueDetail(issueServiceType);
  // file size
  const { maxFileSize } = useFileSize();
  // operations
  const { operations: attachmentOperations } = useAttachmentOperations(
    workspaceSlug,
    projectId,
    issueId,
    issueServiceType
  );
  // handlers
  const handleFetchPropertyActivities = useCallback(() => {
    fetchActivities(workspaceSlug, projectId, issueId);
  }, [fetchActivities, workspaceSlug, projectId, issueId]);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      const totalAttachedFiles = acceptedFiles.length + rejectedFiles.length;

      if (totalAttachedFiles > 1) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "업로드 실패",
          message: "한 번에 하나의 파일만 업로드할 수 있습니다.",
        });
        return;
      }

      if (acceptedFiles.length === 1) {
        const currentFile = acceptedFiles[0];
        const validationResult = await validateFile(currentFile);

        if (!validationResult.isValid) {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "업로드 실패",
            message: validationResult.error || "파일 업로드 중 오류가 발생했습니다.",
          });
          return;
        }

        if (!workspaceSlug) return;

        setIsLoading(true);
        attachmentOperations
          .create(currentFile)
          .catch((error: any) => {
            console.error("Upload error:", error);
            let errorMessage = "파일 업로드 중 오류가 발생했습니다.";

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
        title: "Error!",
        message:
          totalAttachedFiles > 1
            ? "Only one file can be uploaded at a time."
            : `File must be of ${maxFileSize / 1024 / 1024}MB or less in size.`,
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
        // TODO: Remove extra div and move event propagation to button
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
