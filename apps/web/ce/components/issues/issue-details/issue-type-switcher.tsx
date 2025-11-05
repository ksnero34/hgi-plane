"use client";

import React, { useState } from "react";
import { observer } from "mobx-react";
import { RefreshCw } from "lucide-react";
// ui
import { Tooltip } from "@plane/propel/tooltip";
// store hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueIdentifier } from "./issue-identifier";
import { CreateUpdateIssueModal } from "@/components/issues/issue-modal/modal";

export type TIssueTypeSwitcherProps = {
  issueId: string;
  disabled: boolean;
  onClose?: () => void;
  onOpenModal?: (issueId: string) => void;
};

export const IssueTypeSwitcher: React.FC<TIssueTypeSwitcherProps> = observer((props) => {
  const { issueId, disabled, onClose, onOpenModal } = props;
  // local state
  const [isEditIssueModalOpen, setIsEditIssueModalOpen] = useState(false);
  // store hooks
  const {
    issue: { getIssueById },
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
                if (onOpenModal && onClose) {
                  // peek-overview에서 호출된 경우: 외부 모달 열기
                  onOpenModal(issueId);
                  setTimeout(() => onClose(), 50); // 모달이 먼저 열리도록 지연
                } else {
                  // 일반 컨텍스트에서 호출된 경우: 내부 모달 열기
                  setIsEditIssueModalOpen(true);
                }
              }}
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </Tooltip>
        )}
      </div>

      <CreateUpdateIssueModal
        isOpen={isEditIssueModalOpen}
        onClose={() => setIsEditIssueModalOpen(false)}
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
