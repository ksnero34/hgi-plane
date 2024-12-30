"use client";

import { useMemo, useCallback, useEffect } from "react";
// hooks
import { TOAST_TYPE, setPromiseToast, setToast } from "@plane/ui";
import { IssueAttachmentUpload, IssueAttachmentsList } from "@/components/issues";
import { TAttachmentOperations } from "@/components/issues/issue-detail-widgets/attachments/helper";
import { useEventTracker, useIssueDetail, useFileValidation, useInstance } from "@/hooks/store";
import { validateFileBeforeUpload, handleUploadError } from "@/components/issues/attachment/helper";
import { useDropzone, FileRejection } from "react-dropzone";
import { MAX_FILE_SIZE } from "@/constants/common";

type Props = {
  disabled: boolean;
  issueId: string;
  projectId: string;
  workspaceSlug: string;
};

export const PeekOverviewIssueAttachments: React.FC<Props> = (props) => {
  const { disabled, issueId, projectId, workspaceSlug } = props;
  // store hooks
  const { captureIssueEvent } = useEventTracker();
  const {
    attachment: { createAttachment, removeAttachment },
  } = useIssueDetail();
  const { validateFile, getAcceptedFileTypes } = useFileValidation();
  const { fetchFileSettings, fileSettings } = useInstance();

  // 컴포넌트 마운트 시 file settings 가져오기
  useEffect(() => {
    fetchFileSettings().catch(console.error);
  }, [fetchFileSettings]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const validationResult = await validateFile(file);
    if (!validationResult.isValid) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Invalid file",
        message: validationResult.error || "Invalid file",
      });
      return;
    }

    await handleAttachmentOperations.create(file);
  }, []);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
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

  const handleAttachmentOperations: TAttachmentOperations = useMemo(
    () => ({
      create: async (file: File) => {
        try {
          if (!workspaceSlug || !projectId || !issueId) throw new Error("Missing required fields");

          try {
            await fetchFileSettings();
          } catch (error) {
            console.error("Failed to fetch latest file settings:", error);
          }

          const isValid = await validateFileBeforeUpload(file, validateFile);
          if (!isValid) return;

          const attachmentUploadPromise = createAttachment(workspaceSlug, projectId, issueId, file);
          setPromiseToast(attachmentUploadPromise, {
            loading: "Uploading attachment...",
            success: {
              title: "Attachment uploaded",
              message: () => "The attachment has been successfully uploaded",
            },
            error: {
              title: "Attachment not uploaded",
              message: (error: any) => {
                if (error?.response?.data?.error) return error.response.data.error;
                return "The attachment could not be uploaded";
              },
            },
          });

          const res = await attachmentUploadPromise;
          captureIssueEvent({
            eventName: "Issue attachment added",
            payload: { id: issueId, state: "SUCCESS", element: "Issue detail page" },
            updates: {
              changed_property: "attachment",
              change_details: res.id,
            },
          });
        } catch (error) {
          handleUploadError(error);
          captureIssueEvent({
            eventName: "Issue attachment added",
            payload: { id: issueId, state: "FAILED", element: "Issue detail page" },
          });
        }
      },
      remove: async (attachmentId: string) => {
        try {
          if (!workspaceSlug || !projectId || !issueId) throw new Error("Missing required fields");
          await removeAttachment(workspaceSlug, projectId, issueId, attachmentId);
          setToast({
            message: "The attachment has been successfully removed",
            type: TOAST_TYPE.SUCCESS,
            title: "Attachment removed",
          });
          captureIssueEvent({
            eventName: "Issue attachment deleted",
            payload: { id: issueId, state: "SUCCESS", element: "Issue detail page" },
            updates: {
              changed_property: "attachment",
              change_details: "",
            },
          });
        } catch (error) {
          captureIssueEvent({
            eventName: "Issue attachment deleted",
            payload: { id: issueId, state: "FAILED", element: "Issue detail page" },
            updates: {
              changed_property: "attachment",
              change_details: "",
            },
          });
          setToast({
            message: "The Attachment could not be removed",
            type: TOAST_TYPE.ERROR,
            title: "Attachment not removed",
          });
        }
      },
    }),
    [workspaceSlug, projectId, issueId, captureIssueEvent, createAttachment, removeAttachment, validateFile, fetchFileSettings]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    maxSize: fileSettings?.max_file_size ?? MAX_FILE_SIZE,
    multiple: false,
    disabled: disabled,
    accept: getAcceptedFileTypes(),
    noClick: false,
    noKeyboard: false,
  });

  return (
    <div>
      <h6 className="text-sm font-medium">Attachments</h6>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">
        <IssueAttachmentUpload
          workspaceSlug={workspaceSlug}
          disabled={disabled}
          attachmentOperations={handleAttachmentOperations}
          validateFile={validateFile}
        />
        <IssueAttachmentsList
          issueId={issueId}
          disabled={disabled}
          attachmentHelpers={{
            operations: handleAttachmentOperations,
            snapshot: {
              uploadStatus: undefined
            }
          }}
        />
      </div>
    </div>
  );
};
