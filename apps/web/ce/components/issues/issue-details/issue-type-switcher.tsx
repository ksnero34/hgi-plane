import { useState } from "react";
import { observer } from "mobx-react";
import { RefreshCw } from "lucide-react";
// ui
import { Tooltip } from "@plane/ui";
// store hooks
import { useIssueDetail } from "@/hooks/store";
// plane web components
import { IssueIdentifier } from "@/plane-web/components/issues";
// components
import { IssueEditModal } from "./issue-edit-modal";

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
      
      <IssueEditModal
        isOpen={isEditIssueModalOpen === issueId}
        onClose={() => toggleEditIssueModal(null)}
        issueId={issueId}
        projectId={issue.project_id}
      />
    </>
  );
});
