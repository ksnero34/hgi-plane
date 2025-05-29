import React, { FC, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Button, ModalCore, EModalWidth, EModalPosition } from "@plane/ui";
import { useTranslation } from "@plane/i18n";
import { TIssue } from "@plane/types";
import { Check, X } from "lucide-react";
import { useProject, useProjectState, useMember } from "@/hooks/store";

type TBulkEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedIssues: TIssue[];
  onBulkUpdate: (updates: Partial<TIssue>) => Promise<void>;
};

export const BulkEditModal: FC<TBulkEditModalProps> = observer((props) => {
  const { isOpen, onClose, selectedIssues, onBulkUpdate } = props;
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams() as { workspaceSlug: string; projectId: string };
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [updates, setUpdates] = useState<Partial<TIssue>>({});

  // Store hooks
  const { currentProjectDetails } = useProject();
  const { projectStates } = useProjectState();
  const { 
    project: { getProjectMemberIds, getProjectMemberDetails }
  } = useMember();

  // Get project data
  const projectStatesList = projectStates;
  const projectMemberIds = getProjectMemberIds(projectId, true);

  const handleUpdate = async () => {
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setIsUpdating(true);
    try {
      await onBulkUpdate(updates);
      onClose();
      setUpdates({});
    } catch (error) {
      console.error("Bulk update failed:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFieldChange = (field: keyof TIssue, value: any) => {
    setUpdates(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    setUpdates({});
    onClose();
  };

  return (
    <ModalCore
      isOpen={isOpen}
      handleClose={handleClose}
      position={EModalPosition.TOP}
      width={EModalWidth.LG}
    >
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-medium mb-2">
            {t("issue.bulk_edit.label")}
          </h2>
          <p className="text-sm text-custom-text-300">
            선택된 {selectedIssues.length}개 작업 항목의 속성을 한번에 변경합니다.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {/* 상태 변경 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-custom-text-200">
              상태
            </label>
            <div className="flex items-center gap-2">
              <select
                className="px-3 py-2 border border-custom-border-200 rounded-md text-sm min-w-[200px]"
                onChange={(e) => handleFieldChange('state_id', e.target.value || null)}
                defaultValue=""
              >
                <option value="">변경하지 않음</option>
                {projectStatesList?.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 담당자 변경 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-custom-text-200">
              담당자
            </label>
            <div className="flex items-center gap-2">
              <select
                className="px-3 py-2 border border-custom-border-200 rounded-md text-sm min-w-[200px]"
                onChange={(e) => handleFieldChange('assignee_ids', e.target.value ? [e.target.value] : [])}
                defaultValue=""
              >
                <option value="">변경하지 않음</option>
                <option value="">담당자 없음</option>
                {projectMemberIds?.map((memberId) => {
                  const memberDetails = getProjectMemberDetails(projectId, memberId);
                  const displayName = memberDetails?.member?.display_name || 
                                    memberDetails?.member?.first_name || 
                                    memberDetails?.member?.email || 
                                    "Unknown Member";
                  return (
                    <option key={memberId} value={memberId}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* 우선순위 변경 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-custom-text-200">
              우선순위
            </label>
            <div className="flex items-center gap-2">
              <select
                className="px-3 py-2 border border-custom-border-200 rounded-md text-sm min-w-[200px]"
                onChange={(e) => handleFieldChange('priority', e.target.value || null)}
                defaultValue=""
              >
                <option value="">변경하지 않음</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          {/* 라벨 변경 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-custom-text-200">
              라벨
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="라벨을 쉼표로 구분하여 입력"
                className="px-3 py-2 border border-custom-border-200 rounded-md text-sm min-w-[200px]"
                onChange={(e) => {
                  const labels = e.target.value.split(',').map(l => l.trim()).filter(Boolean);
                  handleFieldChange('label_ids', labels);
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="neutral-primary"
            onClick={handleClose}
            disabled={isUpdating}
          >
            <X className="h-4 w-4 mr-2" />
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdate}
            loading={isUpdating}
            disabled={isUpdating}
          >
            <Check className="h-4 w-4 mr-2" />
            변경 적용
          </Button>
        </div>
      </div>
    </ModalCore>
  );
}); 