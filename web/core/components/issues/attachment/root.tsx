"use client";

import { FC, useEffect } from "react";
import { observer } from "mobx-react";
// hooks
import { useAttachmentOperations } from "../issue-detail-widgets/attachments/helper";
import { useFileValidation, useInstance } from "@/hooks/store";
// components
import { IssueAttachmentUpload } from "./attachment-upload";
import { IssueAttachmentsList } from "./attachments-list";

export type TIssueAttachmentRoot = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
};

export const IssueAttachmentRoot: FC<TIssueAttachmentRoot> = observer((props) => {
  // props
  const { workspaceSlug, projectId, issueId, disabled = false } = props;
  
  // hooks
  const attachmentHelpers = useAttachmentOperations(workspaceSlug, projectId, issueId);
  const { validateFile } = useFileValidation();
  const { fetchFileSettings } = useInstance();

  // fetch file settings on mount
  useEffect(() => {
    fetchFileSettings().catch(console.error);
  }, [fetchFileSettings]);

  return (
    <div className="relative">
      <IssueAttachmentUpload
        workspaceSlug={workspaceSlug}
        disabled={disabled}
        attachmentOperations={attachmentHelpers.operations}
        validateFile={validateFile}
      />
      <IssueAttachmentsList
        issueId={issueId}
        disabled={disabled}
        attachmentHelpers={attachmentHelpers}
      />
    </div>
  );
});
