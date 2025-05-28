"use client";

import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { Settings } from "lucide-react";
// types
import { TIssue, TCustomField } from "@plane/types";
// components
import { CustomFieldDropdown, DateDropdown, MemberDropdown } from "@/components/dropdowns";

type Props = {
  issue: TIssue;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
  onClose: () => void;
};

export const SpreadsheetCustomFieldColumn: React.FC<Props> = observer((props) => {
  const { issue, onChange, disabled, onClose } = props;
  
  // states
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 커스텀 필드 목록 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!issue.project_id) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/workspaces/${issue.workspace}/projects/${issue.project_id}/custom-fields/`,
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

    fetchCustomFields();
  }, [issue.project_id, issue.workspace]);

  // 특정 필드의 현재 값 가져오기
  const getFieldValue = (fieldId: string) => {
    const fieldValue = issue?.custom_field_values?.find(cfv => cfv.custom_field_id === fieldId);
    return fieldValue?.value;
  };

  // 필드 값 업데이트
  const updateFieldValue = (fieldId: string, value: any) => {
    const currentValues = issue?.custom_field_values || [];
    const updatedValues = [...currentValues];
    
    // 해당 필드의 값이 이미 있는지 확인
    const existingIndex = updatedValues.findIndex(cfv => cfv.custom_field_id === fieldId);
    
    if (existingIndex >= 0) {
      // 기존 값 업데이트 또는 제거
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
        // 값이 비어있으면 제거
        updatedValues.splice(existingIndex, 1);
      } else {
        updatedValues[existingIndex] = {
          ...updatedValues[existingIndex],
          value: value
        };
      }
    } else if (value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) {
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
    onChange(issue, { custom_field_values: updatedValues }, { 
      changed_property: "custom_fields", 
      change_details: { field_id: fieldId, value } 
    });
  };

  // 커스텀 필드 값들을 표시
  const customFieldsDisplay = () => {
    if (!issue.custom_field_values || !Array.isArray(issue.custom_field_values)) {
      return null;
    }

    const values = issue.custom_field_values.filter(cfv => 
      cfv.value !== null && cfv.value !== undefined && cfv.value !== ""
    );

    if (values.length === 0) return null;
    
    // 첫 번째 값만 표시하고 나머지는 개수로 표시
    const firstValue = values[0];
    const field = customFields.find(f => f.id === firstValue.custom_field_id);
    
    if (values.length === 1) {
      if (field?.field_type === "multiselect" && Array.isArray(firstValue.value)) {
        return `${firstValue.value.length}개 선택됨`;
      }
      return String(firstValue.value);
    }
    
    return `${values.length}개 필드`;
  };

  // 첫 번째 커스텀 필드에 대한 드롭다운 렌더링 (간단한 편집을 위해)
  const renderFirstFieldDropdown = () => {
    if (customFields.length === 0) return null;
    
    const firstField = customFields[0];
    const fieldValue = getFieldValue(firstField.id);

    switch (firstField.field_type) {
      case "select":
      case "multiselect":
        return (
          <CustomFieldDropdown
            field={firstField}
            value={fieldValue}
            onChange={(val) => updateFieldValue(firstField.id, val)}
            buttonVariant="transparent-without-text"
            className="h-full w-full"
            buttonContainerClassName="h-full w-full"
            buttonClassName="h-full w-full px-2.5 py-1 text-xs border-none rounded-none group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10"
            disabled={disabled}
            placeholder={firstField.name}
            showTooltip={false}
            onClose={onClose}
          />
        );

      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={(date) => updateFieldValue(firstField.id, date)}
            buttonVariant="transparent-without-text"
            className="h-full w-full"
            buttonContainerClassName="h-full w-full"
            buttonClassName="h-full w-full px-2.5 py-1 text-xs border-none rounded-none group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10"
            disabled={disabled}
            placeholder={firstField.name}
            showTooltip={false}
            hideIcon
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            projectId={issue.project_id}
            value={fieldValue ? [fieldValue] : []}
            onChange={(val) => updateFieldValue(firstField.id, val && val.length > 0 ? val[0] : null)}
            buttonVariant="transparent-without-text"
            className="h-full w-full"
            buttonContainerClassName="h-full w-full"
            buttonClassName="h-full w-full px-2.5 py-1 text-xs border-none rounded-none group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10"
            disabled={disabled}
            placeholder={firstField.name}
            showTooltip={false}
            hideIcon
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            projectId={issue.project_id}
            value={Array.isArray(fieldValue) ? fieldValue : []}
            onChange={(val) => updateFieldValue(firstField.id, val && val.length > 0 ? val : null)}
            buttonVariant="transparent-without-text"
            className="h-full w-full"
            buttonContainerClassName="h-full w-full"
            buttonClassName="h-full w-full px-2.5 py-1 text-xs border-none rounded-none group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10"
            disabled={disabled}
            multiple
            placeholder={firstField.name}
            showTooltip={false}
            hideIcon
          />
        );

      default:
        return null;
    }
  };

  const displayValue = customFieldsDisplay();

  if (isLoading) {
    return (
      <div className="h-11 border-b-[0.5px] border-custom-border-200 w-full">
        <div className="flex h-full w-full items-center justify-center px-2.5 py-1 text-xs group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10">
          <Settings className="h-3.5 w-3.5 text-custom-text-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-11 border-b-[0.5px] border-custom-border-200 w-full">
      {customFields.length > 0 && !disabled ? (
        renderFirstFieldDropdown() || (
          <div className="flex h-full w-full items-center justify-start px-2.5 py-1 text-xs group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10">
            {displayValue ? (
              <span className="truncate">{displayValue}</span>
            ) : (
              <Settings className="h-3.5 w-3.5 text-custom-text-400" />
            )}
          </div>
        )
      ) : (
        <div className="flex h-full w-full items-center justify-start px-2.5 py-1 text-xs group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10">
          {displayValue ? (
            <span className="truncate">{displayValue}</span>
          ) : (
            <Settings className="h-3.5 w-3.5 text-custom-text-400" />
          )}
        </div>
      )}
    </div>
  );
}); 