import React, { FC, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Button, ModalCore, EModalWidth, EModalPosition } from "@plane/ui";
import { useTranslation } from "@plane/i18n";
import { TIssue, TCustomField } from "@plane/types";
import { Check, X, Tag, CalendarCheck2, UserCircle2, Users, Settings, AlertTriangle } from "lucide-react";
import { useProject, useProjectState, useMember, useUser, useUserPermissions } from "@/hooks/store";
import { DateDropdown, MemberDropdown, CustomFieldDropdown } from "@/components/dropdowns";
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";

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
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  const [customFieldUpdates, setCustomFieldUpdates] = useState<{[fieldId: string]: any}>({});
  const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(false);

  // Store hooks
  const { currentProjectDetails } = useProject();
  const { projectStates } = useProjectState();
  const { 
    project: { getProjectMemberIds, getProjectMemberDetails },
    getUserDetails
  } = useMember();
  const { currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();

  // Get project data
  const projectStatesList = projectStates;
  const projectMemberIds = getProjectMemberIds(projectId, true);

  // 권한 체크 함수
  const checkIssueEditPermission = (issue: TIssue): boolean => {
    // 1. Admin/Member는 모든 이슈 수정 가능
    const hasFullEditAccess = allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      workspaceSlug,
      projectId
    );
    
    if (hasFullEditAccess) return true;

    // 2. Viewer/Restricted는 자신에게 할당된 이슈만 수정 가능
    const isViewerOrRestricted = allowPermissions(
      [EUserPermissions.VIEWER, EUserPermissions.RESTRICTED],
      EUserPermissionsLevel.PROJECT,
      workspaceSlug,
      projectId
    );

    if (isViewerOrRestricted && currentUser?.id) {
      const assigneeIds = issue.assignee_ids || [];
      return assigneeIds.includes(currentUser.id);
    }

    return false;
  };

  // 수정 가능한 이슈들과 불가능한 이슈들 분리
  const editableIssues = selectedIssues.filter(issue => checkIssueEditPermission(issue));
  const nonEditableIssues = selectedIssues.filter(issue => !checkIssueEditPermission(issue));

  // 커스텀 필드 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!workspaceSlug || !projectId || isLoadingCustomFields) return;
      
      try {
        setIsLoadingCustomFields(true);
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`,
          {
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          setCustomFields(data || []);
        }
      } catch (error) {
        console.error("커스텀 필드 로드 중 오류:", error);
      } finally {
        setIsLoadingCustomFields(false);
      }
    };

    if (isOpen) {
      fetchCustomFields();
    }
  }, [workspaceSlug, projectId, isOpen]);

  const handleUpdate = async () => {
    if (Object.keys(updates).length === 0 && Object.keys(customFieldUpdates).length === 0) {
      onClose();
      return;
    }

    if (editableIssues.length === 0) {
      onClose();
      return;
    }

    setIsUpdating(true);
    try {
      // 커스텀 필드 업데이트가 있으면 custom_field_values 형태로 변환
      const finalUpdates = { ...updates };
      if (Object.keys(customFieldUpdates).length > 0) {
        const customFieldValues = Object.entries(customFieldUpdates)
          .filter(([_, value]) => value !== null && value !== undefined && value !== "")
          .map(([fieldId, value]) => {
            const field = customFields.find(f => f.id === fieldId);
            return {
              custom_field_id: fieldId,
              value: value,
              field_name: field?.name || "",
              field_type: field?.field_type || "text"
            };
          });
        
        if (customFieldValues.length > 0) {
          finalUpdates.custom_field_values = customFieldValues;
        }
      }

      // 수정 가능한 이슈들만 업데이트
      await onBulkUpdate(finalUpdates);
      onClose();
      setUpdates({});
      setCustomFieldUpdates({});
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

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldUpdates(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleClose = () => {
    setUpdates({});
    setCustomFieldUpdates({});
    onClose();
  };

  // 커스텀 필드 타입에 따른 아이콘 반환
  const getCustomFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "select":
      case "multiselect":
        return Tag;
      case "date":
        return CalendarCheck2;
      case "project_member":
        return UserCircle2;
      case "project_members":
        return Users;
      default:
        return Settings;
    }
  };

  // 커스텀 필드 렌더링
  const renderCustomFieldInput = (field: TCustomField) => {
    const FieldIcon = getCustomFieldIcon(field.field_type);
    const fieldValue = customFieldUpdates[field.id];

    switch (field.field_type) {
      case "select":
      case "multiselect":
        return (
          <CustomFieldDropdown
            field={field}
            value={fieldValue}
            onChange={(value) => handleCustomFieldChange(field.id, value)}
            buttonVariant="border-with-text"
            className="min-w-[200px]"
            placeholder={`${field.name} 선택`}
          />
        );

      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={(date) => handleCustomFieldChange(field.id, date ? renderFormattedPayloadDate(date) : null)}
            buttonVariant="border-with-text"
            className="min-w-[200px]"
            placeholder={`${field.name} 선택`}
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            projectId={projectId}
            value={fieldValue}
            onChange={(value) => handleCustomFieldChange(field.id, value)}
            buttonVariant="border-with-text"
            className="min-w-[200px]"
            placeholder={`${field.name} 선택`}
            multiple={false}
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            projectId={projectId}
            value={fieldValue || []}
            onChange={(value) => handleCustomFieldChange(field.id, value)}
            buttonVariant="border-with-text"
            className="min-w-[200px]"
            placeholder={`${field.name} 선택`}
            multiple
          />
        );

      default:
        return (
          <input
            type="text"
            placeholder={`${field.name} 입력`}
            className="px-3 py-2 border border-custom-border-200 rounded-md text-sm min-w-[200px]"
            value={fieldValue || ""}
            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
          />
        );
    }
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
            선택된 {selectedIssues.length}개 작업 항목 중 {editableIssues.length}개를 변경할 수 있습니다.
          </p>
          
          {/* 권한 경고 메시지 */}
          {nonEditableIssues.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  {nonEditableIssues.length}개 작업 항목은 수정 권한이 없어 변경되지 않습니다.
                </span>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                자신에게 할당된 작업 항목만 수정할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {editableIssues.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-custom-text-300 mx-auto mb-3" />
            <p className="text-custom-text-300">수정 권한이 있는 작업 항목이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
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
                      // 먼저 getUserDetails로 시도
                      const userDetails = getUserDetails(memberId);
                      // 그 다음 getProjectMemberDetails로 시도
                      const memberDetails = getProjectMemberDetails(projectId, memberId);
                      
                      const displayName = userDetails?.display_name || 
                                        userDetails?.first_name || 
                                        userDetails?.email ||
                                        memberDetails?.member?.display_name || 
                                        memberDetails?.member?.first_name || 
                                        memberDetails?.member?.email || 
                                        `멤버 ${memberId.slice(0, 8)}`;
                      
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

              {/* 커스텀 필드들 */}
              {customFields.length > 0 && (
                <>
                  <div className="border-t border-custom-border-200 pt-4">
                    <h3 className="text-sm font-medium text-custom-text-200 mb-3">커스텀 필드</h3>
                  </div>
                  {customFields.map((field) => {
                    const FieldIcon = getCustomFieldIcon(field.field_type);
                    return (
                      <div key={field.id} className="flex items-center justify-between">
                        <label className="text-sm font-medium text-custom-text-200 flex items-center gap-2">
                          <FieldIcon className="h-4 w-4" />
                          {field.name}
                        </label>
                        <div className="flex items-center gap-2">
                          {renderCustomFieldInput(field)}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
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
                {editableIssues.length}개 항목 변경 적용
              </Button>
            </div>
          </>
        )}
      </div>
    </ModalCore>
  );
}); 