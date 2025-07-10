"use client";
import { useMemo } from "react";
import { WORK_ITEM_TRACKER_EVENTS } from "@plane/constants";
import { EIssueServiceType, TIssueServiceType } from "@plane/types";
// plane ui
import { TOAST_TYPE, setPromiseToast, setToast } from "@plane/ui";
// hooks
import { captureError, captureSuccess } from "@/helpers/event-tracker.helper";
import { useIssueDetail } from "@/hooks/store";
// types
import { TAttachmentUploadStatus } from "@/store/issue/issue-details/attachment.store";

export type TAttachmentOperations = {
  create: (file: File) => Promise<void>;
  remove: (attachmentId: string) => Promise<void>;
};

export type TAttachmentSnapshot = {
  uploadStatus: TAttachmentUploadStatus[] | undefined;
};

export type TAttachmentHelpers = {
  operations: TAttachmentOperations;
  snapshot: TAttachmentSnapshot;
};

export const useAttachmentOperations = (
  workspaceSlug: string,
  projectId: string,
  issueId: string,
  issueServiceType: TIssueServiceType = EIssueServiceType.ISSUES
): TAttachmentHelpers => {
  const {
    attachment: { createAttachment, removeAttachment, getAttachmentsUploadStatusByIssueId },
  } = useIssueDetail(issueServiceType);

  const attachmentOperations: TAttachmentOperations = useMemo(
    () => ({
      create: async (file) => {
        try {
          if (!workspaceSlug || !projectId || !issueId) throw new Error("Missing required fields");
          const attachmentUploadPromise = createAttachment(workspaceSlug, projectId, issueId, file);

          await attachmentUploadPromise;
          captureSuccess({
            eventName: WORK_ITEM_TRACKER_EVENTS.attachment.add,
            payload: { id: issueId },
          });
          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: "파일 업로드 성공",
            message: `${file.name} 파일이 성공적으로 업로드되었습니다.`
          });
        } catch (error) {
          captureError({
            eventName: WORK_ITEM_TRACKER_EVENTS.attachment.add,
            payload: { id: issueId },
            error: error as Error,
          });

          // 에러 객체에 서버 응답 추가
          if (error.response?.data) {
            error.serverError = error.response.data;
          }
          throw error;
        }
      },
      remove: async (attachmentId) => {
        try {
          if (!workspaceSlug || !projectId || !issueId) throw new Error("Missing required fields");
          await removeAttachment(workspaceSlug, projectId, issueId, attachmentId);
          setToast({
            message: "첨부파일이 성공적으로 제거되었습니다.",
            type: TOAST_TYPE.SUCCESS,
            title: "첨부파일 제거",
          });
          captureSuccess({
            eventName: WORK_ITEM_TRACKER_EVENTS.attachment.remove,
            payload: { id: issueId },
          });
        } catch (error) {
          captureError({
            eventName: WORK_ITEM_TRACKER_EVENTS.attachment.remove,
            payload: { id: issueId },
            error: error as Error,
          });
          setToast({
            message: "첨부파일을 제거할 수 없습니다.",
            type: TOAST_TYPE.ERROR,
            title: "첨부파일 제거 실패",
          });
        }
      },
    }),
    [workspaceSlug, projectId, issueId, createAttachment, removeAttachment]
  );
  const attachmentsUploadStatus = getAttachmentsUploadStatusByIssueId(issueId);

  return {
    operations: attachmentOperations,
    snapshot: { uploadStatus: attachmentsUploadStatus },
  };
};
