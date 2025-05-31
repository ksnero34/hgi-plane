import React, { FC, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Button, ModalCore, EModalWidth, EModalPosition, DoubleCircleIcon } from "@plane/ui";
import { useTranslation } from "@plane/i18n";
import { TIssue, TCustomField } from "@plane/types";
import { Check, X, Tag, CalendarCheck2, UserCircle2, Users, Settings, AlertTriangle, Signal } from "lucide-react";
import { useProject, useProjectState, useMember, useUser, useUserPermissions } from "@/hooks/store";
import { DateDropdown, MemberDropdown, CustomFieldDropdown, StateDropdown, PriorityDropdown } from "@/components/dropdowns";
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";

type TBulkEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedIssues: TIssue[];
  onBulkUpdate: (payload: { issue_ids: string[]; properties: any }) => Promise<void>;
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
    console.log("[BulkEditModal] handleUpdate called");
    console.log("[BulkEditModal] Updates state:", updates);
    console.log("[BulkEditModal] Custom field updates state:", customFieldUpdates);

    // 실제로 변경할 데이터가 있는지 검증
    const hasRegularUpdates = Object.entries(updates).some(([key, value]) => {
      return value !== null && value !== undefined && value !== "" && 
             !(Array.isArray(value) && value.length === 0);
    });

    const hasCustomFieldUpdates = Object.entries(customFieldUpdates).some(([fieldId, value]) => {
      return value !== null && value !== undefined && value !== "" && 
             !(Array.isArray(value) && value.length === 0);
    });

    console.log("[BulkEditModal] Has regular updates:", hasRegularUpdates);
    console.log("[BulkEditModal] Has custom field updates:", hasCustomFieldUpdates);

    if (!hasRegularUpdates && !hasCustomFieldUpdates) {
      console.log("[BulkEditModal] No valid updates found, closing modal");
      onClose();
      return;
    }

    if (editableIssues.length === 0) {
      console.log("[BulkEditModal] No editable issues, closing modal");
      onClose();
      return;
    }

    setIsUpdating(true);
    try {
      // Prepare custom field values for bulk update - 더 엄격한 필터링
      const customFieldValues = Object.entries(customFieldUpdates)
        .filter(([_, value]) => {
          // null, undefined, 빈 문자열, 빈 배열은 제외
          if (value === null || value === undefined || value === "") return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        })
        .map(([fieldId, value]) => {
          const field = customFields.find(f => f.id === fieldId);
          return {
            custom_field_id: fieldId,
            value: value,
            field_name: field?.name || "",
            field_type: field?.field_type || "text"
          };
        });

      // Prepare properties payload - 빈 값 제거
      const properties: any = {};
      
      // 일반 속성 추가 (빈 값 제외)
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "" && 
            !(Array.isArray(value) && value.length === 0)) {
          properties[key] = value;
        }
      });

      // 커스텀 필드 값 추가
      if (customFieldValues.length > 0) {
        properties.custom_field_values = customFieldValues;
      }

      // 실제로 업데이트할 속성이 있는지 최종 확인
      if (Object.keys(properties).length === 0) {
        console.log("[BulkEditModal] No valid properties to update after filtering");
        onClose();
        return;
      }

      // Single bulk operation API call for all changes
      const bulkUpdatePayload = {
        issue_ids: selectedIssues.map(issue => issue.id), // 모든 선택된 이슈 ID 전송
        properties: properties
      };

      console.log("[BulkEditModal] Final bulk update payload:", JSON.stringify(bulkUpdatePayload, null, 2));
      console.log("[BulkEditModal] Properties to update:", Object.keys(properties));
      console.log("[BulkEditModal] Custom field values count:", customFieldValues.length);

      // 부모 컴포넌트의 onBulkUpdate 함수 사용 (이슈 목록 새로고침 포함)
      await onBulkUpdate(bulkUpdatePayload);
      
      onClose();
      setUpdates({});
      setCustomFieldUpdates({});
    } catch (error) {
      console.error("Bulk update failed:", error);
      // 에러는 부모 컴포넌트에서 처리됨
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFieldChange = (field: keyof TIssue, value: any) => {
    if (value === null || value === undefined || value === "" || 
        (Array.isArray(value) && value.length === 0)) {
      // 값이 비어있으면 updates에서 제거
      setUpdates(prev => {
        const newUpdates = { ...prev };
        delete newUpdates[field];
        return newUpdates;
      });
    } else {
      setUpdates(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    // 값이 실제로 변경되었을 때만 상태 업데이트
    setCustomFieldUpdates(prev => {
      const newUpdates = { ...prev };
      
      // 값이 비어있거나 초기값과 같으면 해당 필드를 제거
      if (value === null || value === undefined || value === "" || 
          (Array.isArray(value) && value.length === 0)) {
        delete newUpdates[fieldId];
      } else {
        newUpdates[fieldId] = value;
      }
      
      return newUpdates;
    });
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
            field={{
              ...field,
              name: fieldValue ? field.name : "변경하지 않음"
            }}
            value={fieldValue}
            onChange={(value) => handleCustomFieldChange(field.id, value)}
            buttonVariant="transparent-with-text"
            className="w-3/5 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            placeholder="변경하지 않음"
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            hideIconWhenEmpty={true}
            showFieldNameWhenEmpty={true}
          />
        );

      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={(date) => handleCustomFieldChange(field.id, date ? renderFormattedPayloadDate(date) : null)}
            buttonVariant="transparent-with-text"
            className="w-3/5 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            placeholder="변경하지 않음"
            hideIcon
            clearIconClassName="h-3 w-3 hidden group-hover:inline"
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            projectId={projectId}
            value={fieldValue}
            onChange={(value) => handleCustomFieldChange(field.id, value)}
            buttonVariant="transparent-with-text"
            className="w-3/5 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            placeholder="변경하지 않음"
            hideIcon={!fieldValue}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            multiple={false}
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            projectId={projectId}
            value={fieldValue || []}
            onChange={(value) => handleCustomFieldChange(field.id, value)}
            buttonVariant="transparent-with-text"
            className="w-3/5 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue && fieldValue.length > 0 ? "" : "text-custom-text-400"}`}
            placeholder="변경하지 않음"
            hideIcon={!fieldValue || fieldValue.length === 0}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            multiple
          />
        );

      default:
        return (
          <div className="w-3/5 flex-grow">
            <input
              type="text"
              placeholder="변경하지 않음"
              className="w-full px-3 py-2 text-sm bg-transparent border-0 text-custom-text-400 focus:outline-none"
              value={fieldValue || ""}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
            />
          </div>
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
              <div className="flex items-center gap-3 h-8">
                <div className="flex items-center gap-1 w-2/5 flex-shrink-0 text-sm text-custom-text-300">
                  <DoubleCircleIcon className="h-4 w-4 flex-shrink-0" />
                  <span>상태</span>
                </div>
                <StateDropdown
                  value={updates.state_id || null}
                  onChange={(val) => handleFieldChange('state_id', val)}
                  projectId={projectId}
                  buttonVariant="transparent-with-text"
                  className="w-3/5 flex-grow group"
                  buttonContainerClassName="w-full text-left"
                  buttonClassName={`text-sm ${updates.state_id ? "" : "text-custom-text-400"}`}
                  placeholder="변경하지 않음"
                  dropdownArrow
                  dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
                />
              </div>

              {/* 담당자 변경 */}
              <div className="flex items-center gap-3 h-8">
                <div className="flex items-center gap-1 w-2/5 flex-shrink-0 text-sm text-custom-text-300">
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span>담당자</span>
                </div>
                <MemberDropdown
                  value={updates.assignee_ids || []}
                  onChange={(val) => handleFieldChange('assignee_ids', val)}
                  projectId={projectId}
                  placeholder="변경하지 않음"
                  multiple
                  buttonVariant="transparent-with-text"
                  className="w-3/5 flex-grow group"
                  buttonContainerClassName="w-full text-left"
                  buttonClassName={`text-sm ${updates.assignee_ids && updates.assignee_ids.length > 0 ? "" : "text-custom-text-400"}`}
                  hideIcon={!updates.assignee_ids || updates.assignee_ids.length === 0}
                  dropdownArrow
                  dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
                />
              </div>

              {/* 우선순위 변경 */}
              <div className="flex items-center gap-3 h-8">
                <div className="flex items-center gap-1 w-2/5 flex-shrink-0 text-sm text-custom-text-300">
                  <Signal className="h-4 w-4 flex-shrink-0" />
                  <span>우선순위</span>
                </div>
                <PriorityDropdown
                  value={updates.priority || null}
                  onChange={(val) => handleFieldChange('priority', val)}
                  buttonVariant="transparent-with-text"
                  className="w-3/5 flex-grow group"
                  buttonContainerClassName="w-full text-left"
                  buttonClassName={`text-sm ${updates.priority ? "" : "text-custom-text-400"}`}
                  placeholder="변경하지 않음"
                />
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
                      <div key={field.id} className="flex items-center gap-3 h-8">
                        <div className="flex items-center gap-1 w-2/5 flex-shrink-0 text-sm text-custom-text-300">
                          <FieldIcon className="h-4 w-4 flex-shrink-0" />
                          <span>{field.name}</span>
                        </div>
                        {renderCustomFieldInput(field)}
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
                disabled={isUpdating || (Object.keys(updates).length === 0 && Object.keys(customFieldUpdates).length === 0)}
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