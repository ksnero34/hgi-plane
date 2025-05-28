import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { Tag, CalendarCheck2, UserCircle2, Users } from "lucide-react";

// ui
import { DateDropdown, MemberDropdown, CustomFieldDropdown } from "@/components/dropdowns";

// types
import { TCustomField } from "@plane/types";
import type { TIssueOperations } from "@/components/issues";

// hooks
import { useIssueDetail } from "@/hooks/store";

type TCustomFieldProperties = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled?: boolean;
};

export const CustomFieldProperties: React.FC<TCustomFieldProperties> = observer((props) => {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled = false } = props;
  
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  
  // states
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // derived values
  const issue = getIssueById(issueId);

  // 커스텀 필드 목록 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`,
          {
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          setCustomFields(data);
        }
      } catch (error) {
        console.error("커스텀 필드 로드 중 오류:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (workspaceSlug && projectId) {
      fetchCustomFields();
    }
  }, [workspaceSlug, projectId]);

  // 특정 필드의 현재 값 가져오기
  const getFieldValue = (fieldId: string) => {
    const fieldValue = issue?.custom_field_values?.find(cfv => cfv.custom_field_id === fieldId);
    return fieldValue?.value;
  };

  // 필드 값 업데이트
  const updateFieldValue = (fieldId: string, value: any) => {
    const updatedValues = [...(issue?.custom_field_values || [])];
    
    // 해당 필드의 값이 이미 있는지 확인
    const existingIndex = updatedValues.findIndex(cfv => cfv.custom_field_id === fieldId);
    
    if (existingIndex >= 0) {
      // 기존 값 업데이트
      if (value === null || value === undefined || value === "") {
        // 값이 비어있으면 제거
        updatedValues.splice(existingIndex, 1);
      } else {
        updatedValues[existingIndex] = {
          ...updatedValues[existingIndex],
          value: value
        };
      }
    } else if (value !== null && value !== undefined && value !== "") {
      // 새 값 추가
      const field = customFields.find(f => f.id === fieldId);
      if (field) {
        updatedValues.push({
          custom_field_id: fieldId,
          value: value,
          field_name: field.name,
          field_type: field.field_type
        });
      }
    }

    // 이슈 업데이트
    issueOperations.update(workspaceSlug, projectId, issueId, {
      custom_field_values: updatedValues
    });
  };

  // 필드 타입에 따른 아이콘 선택
  const getFieldIcon = (fieldType: string) => {
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
        return Tag;
    }
  };

  // 필드 타입에 따른 입력 컴포넌트 렌더링
  const renderFieldInput = (field: TCustomField) => {
    const fieldValue = getFieldValue(field.id);

    switch (field.field_type) {
      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={(date) => updateFieldValue(field.id, date)}
            placeholder="날짜 선택"
            disabled={disabled}
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            hideIcon
            clearIconClassName="h-3 w-3 hidden group-hover:inline"
          />
        );

      case "select":
      case "multiselect":
        return (
          <CustomFieldDropdown
            field={field}
            value={fieldValue}
            onChange={(val) => updateFieldValue(field.id, val)}
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            disabled={disabled}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val) => updateFieldValue(field.id, val)}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            disabled={disabled}
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            hideIcon={!fieldValue}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val) => updateFieldValue(field.id, val)}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            disabled={disabled}
            multiple
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue && fieldValue.length > 0 ? "" : "text-custom-text-400"}`}
            hideIcon={!fieldValue || fieldValue.length === 0}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        );

      default:
        return (
          <div className="w-3/4 flex-grow">
            <div className="w-full h-full flex items-center gap-1.5 rounded px-2 py-0.5 text-sm justify-between cursor-not-allowed">
              <span className="flex-grow truncate text-xs leading-5 text-custom-text-400">
                지원하지 않는 필드 타입
              </span>
            </div>
          </div>
        );
    }
  };

  if (isLoading || !issue || customFields.length === 0) return null;

  return (
    <>
      {customFields.map((field) => {
        const FieldIcon = getFieldIcon(field.field_type);

        return (
          <div key={field.id} className="flex w-full items-center gap-3 h-8">
            <div className="flex items-center gap-1 w-1/4 flex-shrink-0 text-sm text-custom-text-300">
              <FieldIcon className="h-4 w-4 flex-shrink-0" />
              <span>{field.name}</span>
            </div>
            {renderFieldInput(field)}
          </div>
        );
      })}
    </>
  );
}); 