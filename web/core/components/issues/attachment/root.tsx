"use client";

import { FC, useMemo, useCallback, useEffect } from "react";
// hooks
import { TOAST_TYPE, setPromiseToast, setToast } from "@plane/ui";
import { useEventTracker, useIssueDetail, useFileValidation, useInstance } from "@/hooks/store";
import { validateFileBeforeUpload, handleUploadError } from "./helper";
// ui
// components
import { IssueAttachmentUpload } from "./attachment-upload";
import { IssueAttachmentsList } from "./attachments-list";
import { useDropzone, FileRejection } from "react-dropzone";

export type TIssueAttachmentRoot = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
};

export type TAttachmentOperations = {
  create: (data: FormData) => Promise<void>;
  remove: (linkId: string) => Promise<void>;
};

export const IssueAttachmentRoot: FC<TIssueAttachmentRoot> = (props) => {
  // props
  const { workspaceSlug, projectId, issueId, disabled = false } = props;
  // hooks
  const { createAttachment, removeAttachment } = useIssueDetail();
  const { captureIssueEvent } = useEventTracker();
  const { validateFile } = useFileValidation();
  const { fetchFileSettings } = useInstance();

  // 컴포넌트 마운트 시 file settings 가져오기
  useEffect(() => {
    fetchFileSettings().catch(console.error);
  }, [fetchFileSettings]);

  const handleAttachmentOperations: TAttachmentOperations = useMemo(
    () => ({
      create: async (data: FormData) => {
        try {
          if (!workspaceSlug || !projectId || !issueId) throw new Error("Missing required fields");

          // 파일 업로드 전 최신 설정 가져오기
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
              message: (error) => error.response?.data?.error || "The attachment could not be uploaded",
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
    [captureIssueEvent, workspaceSlug, projectId, issueId, createAttachment, removeAttachment, validateFile, fetchFileSettings]
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
    maxSize: fileSettings?.max_file_size ?? MAX_FILE_SIZE,
    multiple: false,
    disabled: isLoading || disabled,
    accept: getAcceptedFileTypes(),
    noClick: false,
    noKeyboard: false,
  });

  return (
    <div className="relative py-3 space-y-3">
      <h3 className="text-lg">Attachments</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <IssueAttachmentUpload
          workspaceSlug={workspaceSlug}
          disabled={disabled}
          handleAttachmentOperations={handleAttachmentOperations}
        />
        <IssueAttachmentsList
          issueId={issueId}
          disabled={disabled}
          handleAttachmentOperations={handleAttachmentOperations}
        />
      </div>
    </div>
  );
};
