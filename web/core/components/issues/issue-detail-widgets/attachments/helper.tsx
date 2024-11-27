"use client";
import { useMemo, useCallback, useState, useEffect } from "react";
import { TOAST_TYPE, setPromiseToast, setToast } from "@plane/ui";
// type
import { TAttachmentOperations } from "@/components/issues/attachment";
// hooks
import { useEventTracker, useIssueDetail, useFileValidation, useInstance } from "@/hooks/store";
import { validateFileBeforeUpload, handleUploadError } from "@/components/issues/attachment/helper";
import { useDropzone, FileRejection } from "react-dropzone";
import { MAX_FILE_SIZE } from "@/constants/common";

export const useAttachmentOperations = (
  workspaceSlug: string,
  projectId: string,
  issueId: string,
  disabled: boolean = false
): TAttachmentOperations => {
  const { createAttachment, removeAttachment } = useIssueDetail();
  const { captureIssueEvent } = useEventTracker();
  const { validateFile, getAcceptedFileTypes } = useFileValidation();
  const { fileSettings, fetchFileSettings } = useInstance();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchFileSettings().catch(console.error);
  }, [fetchFileSettings]);

  const handleAttachmentOperations: TAttachmentOperations = useMemo(
    () => ({
      create: async (data: FormData) => {
        try {
          if (!workspaceSlug || !projectId || !issueId) throw new Error("Missing required fields");

          try {
            await fetchFileSettings();
          } catch (error) {
            console.error("Failed to fetch latest file settings:", error);
          }

          const file = data.get("asset") as File;
          if (!validateFileBeforeUpload(file, validateFile)) return;

          const attachmentUploadPromise = createAttachment(workspaceSlug, projectId, issueId, data);
          setPromiseToast(attachmentUploadPromise, {
            loading: "Uploading attachment...",
            success: {
              title: "Attachment uploaded",
              message: () => "The attachment has been successfully uploaded",
            },
            error: {
              title: "Attachment not uploaded",
              message: () => "The attachment could not be uploaded",
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
    [workspaceSlug, projectId, issueId, createAttachment, removeAttachment, validateFile, fetchFileSettings]
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
    onDropRejected,
    maxSize: fileSettings?.max_file_size ?? MAX_FILE_SIZE,
    multiple: false,
    disabled: isLoading || disabled,
    accept: getAcceptedFileTypes(),
    noClick: false,
    noKeyboard: false,
  });

  return handleAttachmentOperations;
};
