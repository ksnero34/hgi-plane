import React from "react";
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

export const IssueTypeSwitcher = observer(function IssueTypeSwitcher(props: TIssueTypeSwitcherProps) {
  const { issueId, disabled, onClose, onOpenModal } = props;
  // store hooks
  const {
    issue: { getIssueById },
    isEditIssueModalOpen,
    toggleEditIssueModal,
    peekIssue,
  } = useIssueDetail();
  // derived values
  const issue = getIssueById(issueId);

  if (!issue || !issue.project_id) return <></>;

  // 이 issue가 현재 peek되고 있는지 확인
  const isCurrentlyPeeked = peekIssue?.issueId === issueId;

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
                if (onOpenModal) {
                  // peek-overview에서 호출된 경우: peek 내부의 local modal 열기
                  onOpenModal(issueId);
                } else {
                  // 일반 페이지에서 호출된 경우: store의 global modal 열기
                  toggleEditIssueModal(issueId);
                }
              }}
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* 현재 peek되고 있는 issue가 아닐 때만 modal 렌더링 */}
      {!isCurrentlyPeeked && (
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
      )}
    </>
  );
});
