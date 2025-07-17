"use client";

import React from "react";
import { observer } from "mobx-react";
import { RefreshCw } from "lucide-react";
// ui
import { Tooltip } from "@plane/ui";
// store hooks
import { useIssueDetail } from "@/hooks/store";
// components
import { IssueIdentifier } from "./issue-identifier";
import { CreateUpdateIssueModal } from "@/components/issues";

export type TIssueTypeSwitcherProps = {
  issueId: string;
  disabled: boolean;
};

export const IssueTypeSwitcher: React.FC<TIssueTypeSwitcherProps> = observer((props) => {
  const { issueId, disabled } = props;
  // store hooks
  const {
    issue: { getIssueById },
    isEditIssueModalOpen,
    toggleEditIssueModal,
  } = useIssueDetail();
  // derived values
  const issue = getIssueById(issueId);

  if (!issue || !issue.project_id) return <></>;

  return (
    <>
      <div className="flex items-center gap-2">
        <IssueIdentifier issueId={issueId} projectId={issue.project_id} size="md" enableClickToCopyIdentifier />
        {!disabled && (
          <Tooltip tooltipContent="작업 항목 수정">
            <button
              type="button"
              className="flex items-center justify-center w-6 h-6 text-custom-text-400 hover:text-custom-text-300 transition-colors"
              onClick={() => {
                toggleEditIssueModal(issueId);
              }}
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </Tooltip>
        )}
      </div>
      
      <CreateUpdateIssueModal
        isOpen={isEditIssueModalOpen === issueId}
        onClose={() => toggleEditIssueModal(null)}
        data={issue}
        storeType={undefined}
        modalTitle="작업 항목 수정"
        primaryButtonText={{
          default: "수정",
          loading: "수정 중...",
        }}
      />
    </>
  );
});