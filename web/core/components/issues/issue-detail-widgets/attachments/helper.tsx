"use client";
import { useMemo } from "react";
import { EIssueServiceType } from "@plane/constants";
import { TIssueServiceType } from "@plane/types";
// plane ui
import { TOAST_TYPE, setPromiseToast, setToast } from "@plane/ui";
// hooks
import { useEventTracker, useIssueDetail } from "@/hooks/store";
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
  const { captureIssueEvent } = useEventTracker();

  const attachmentOperations: TAttachmentOperations = useMemo(
    () => ({
      create: async (file) => {
        try {
          if (!workspaceSlug || !projectId || !issueId) throw new Error("Missing required fields");
          const attachmentUploadPromise = createAttachment(workspaceSlug, projectId, issueId, file);

          const res = await attachmentUploadPromise;
          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: "파일 업로드 성공",
            message: `${file.name} 파일이 성공적으로 업로드되었습니다.`
          });
          
          captureIssueEvent({
            eventName: "Issue attachment added",
            payload: { id: issueId, state: "SUCCESS", element: "Issue detail page" },
            updates: {
              changed_property: "attachment",
              change_details: res.id,
            },
          });
        } catch (error: any) {
          captureIssueEvent({
            eventName: "Issue attachment added",
            payload: { id: issueId, state: "FAILED", element: "Issue detail page" },
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
            message: "첨부파일을 제거할 수 없습니다.",
            type: TOAST_TYPE.ERROR,
            title: "첨부파일 제거 실패",
          });
        }
      },
    }),
    [captureIssueEvent, workspaceSlug, projectId, issueId, createAttachment, removeAttachment]
  );
  const attachmentsUploadStatus = getAttachmentsUploadStatusByIssueId(issueId);

  return {
    operations: attachmentOperations,
    snapshot: { uploadStatus: attachmentsUploadStatus },
  };
};
