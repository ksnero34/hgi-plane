"use client";

import React, { SyntheticEvent } from "react";
import { observer } from "mobx-react";
import { Tag, Tags, CalendarCheck2, UserCircle2, Users, Settings } from "lucide-react";
// types
import { TIssue, TCustomField, IIssueDisplayProperties } from "@plane/types";
// ui
import { Tooltip } from "@plane/ui";
// helpers
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// components
import { CustomFieldDropdown, DateDropdown, MemberDropdown } from "@/components/dropdowns";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";
import { cn } from "@/helpers/common.helper";

type Props = {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  isReadOnly: boolean;
  activeLayout: string;
  displayProperties: IIssueDisplayProperties | undefined;
  customFields?: TCustomField[]; // 커스텀 필드를 props로 받음
};

export const IssueCustomFieldProperties: React.FC<Props> = observer((props) => {
  const { issue, updateIssue, isReadOnly, activeLayout, displayProperties, customFields = [] } = props;
  const { isMobile } = usePlatformOS();
  
  if (!customFields || customFields.length === 0 || !displayProperties?.custom_fields) return null;

  // 특정 필드의 현재 값 가져오기
  const getFieldValue = (fieldId: string) => {
    const fieldValue = issue?.custom_field_values?.find(cfv => cfv.custom_field_id === fieldId);
    return fieldValue?.value;
  };

  // 커스텀 필드 값 업데이트 함수
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

    return updatedValues;
  };

  // 필드 타입에 따른 아이콘 선택 (실제 드롭다운에서 사용하는 아이콘과 일치)
  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "select":
        return Tag; // CustomFieldDropdown에서 사용
      case "multiselect":
        return Tags; // CustomFieldDropdown에서 사용 (labels와 구분)
      case "date":
        return CalendarCheck2; // DateDropdown에서 사용 (target_date와 동일)
      case "project_member":
        return UserCircle2; // MemberDropdown에서 사용 (created_by와 동일)
      case "project_members":
        return Users; // MemberDropdown multiple에서 사용 (assignees와 동일)
      default:
        return Settings;
    }
  };

  // 필드 값 포맷팅
  const formatFieldValue = (field: TCustomField, value: any) => {
    if (!value) return "";

    switch (field.field_type) {
      case "select":
        return value;
      case "multiselect":
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(", ") : "";
        }
        return value;
      case "date":
        return renderFormattedPayloadDate(value);
      case "project_member":
      case "project_members":
        return Array.isArray(value) ? `${value.length}명 선택됨` : "선택됨";
      default:
        return value;
    }
  };

  // 이벤트 전파 방지
  const handleEventPropagation = (e: SyntheticEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // 필드 타입에 따른 입력 컴포넌트 렌더링
  const renderFieldDropdown = (field: TCustomField) => {
    const fieldValue = getFieldValue(field.id);
    const formattedValue = formatFieldValue(field, fieldValue);
    const FieldIcon = getFieldIcon(field.field_type);
    const hasValue = fieldValue !== null && fieldValue !== undefined && fieldValue !== "" && 
                     !(Array.isArray(fieldValue) && fieldValue.length === 0);

    switch (field.field_type) {
      case "select":
      case "multiselect":
        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <CustomFieldDropdown
              field={field}
              value={fieldValue}
              onChange={(val) => updateIssue && updateIssue(issue.project_id, issue.id, {
                custom_field_values: updateFieldValue(field.id, val)
              })}
              buttonVariant={hasValue ? "border-with-text" : "border-without-text"}
              className="h-5 min-w-5"
              buttonContainerClassName="h-5 min-w-5"
              buttonClassName={cn(
                "h-5 min-w-5 text-xs border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 rounded flex items-center",
                hasValue ? "px-1.5" : "justify-center px-0"
              )}
              disabled={isReadOnly}
              showTooltip={true}
              dropdownArrow={false}
            />
          </div>
        );

      case "date":
        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <DateDropdown
              value={fieldValue}
              onChange={(date) => updateIssue && updateIssue(issue.project_id, issue.id, {
                custom_field_values: updateFieldValue(field.id, date ? renderFormattedPayloadDate(date) : null)
              })}
              buttonVariant={hasValue ? "border-with-text" : "border-without-text"}
              className="h-5"
              buttonContainerClassName="h-5"
              buttonClassName="h-5 text-xs"
              disabled={isReadOnly}
              showTooltip={true}
              tooltipHeading={field.name}
              tooltipContent={formattedValue || "none"}
              button={!hasValue ? (
                <div className="flex items-center justify-center h-full w-5 border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 rounded">
                  <FieldIcon className="h-3 w-3" />
                </div>
              ) : undefined}
            />
          </div>
        );

      case "project_member":
        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <MemberDropdown
              projectId={issue.project_id}
              value={fieldValue ? [fieldValue] : []}
              onChange={(val) => updateIssue && updateIssue(issue.project_id, issue.id, {
                custom_field_values: updateFieldValue(field.id, val && val.length > 0 ? val[0] : null)
              })}
              buttonVariant={hasValue ? "transparent-without-text" : "border-without-text"}
              className="h-5"
              buttonContainerClassName="h-5"
              buttonClassName={cn(
                "h-5 text-xs",
                hasValue ? "hover:bg-transparent px-0" : "w-5 border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 rounded justify-center"
              )}
              disabled={isReadOnly}
              showTooltip={true}
              tooltipHeading={field.name}
              tooltipContent={formattedValue || "none"}
              button={!hasValue ? (
                <div className="flex items-center justify-center h-full w-full">
                  <FieldIcon className="h-3 w-3" />
                </div>
              ) : undefined}
            />
          </div>
        );

      case "project_members":
        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <MemberDropdown
              projectId={issue.project_id}
              value={Array.isArray(fieldValue) ? fieldValue : []}
              onChange={(val) => updateIssue && updateIssue(issue.project_id, issue.id, {
                custom_field_values: updateFieldValue(field.id, val && val.length > 0 ? val : null)
              })}
              buttonVariant={hasValue ? "transparent-without-text" : "border-without-text"}
              className="h-5"
              buttonContainerClassName="h-5"
              buttonClassName={cn(
                "h-5 text-xs",
                hasValue ? "hover:bg-transparent px-0" : "w-5 border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 rounded justify-center"
              )}
              disabled={isReadOnly}
              multiple
              showTooltip={true}
              tooltipHeading={field.name}
              tooltipContent={formattedValue || "none"}
              button={!hasValue ? (
                <div className="flex items-center justify-center h-full w-full">
                  <FieldIcon className="h-3 w-3" />
                </div>
              ) : undefined}
            />
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-5 w-5 rounded border-[0.5px] border-custom-border-300">
            <FieldIcon className="h-3 w-3" />
          </div>
        );
    }
  };

  return (
    <>
      {customFields.map((field) => (
        <WithDisplayPropertiesHOC
          key={field.id}
          displayProperties={displayProperties}
          displayPropertyKey="custom_fields"
          shouldRenderProperty={() => true}
        >
          {renderFieldDropdown(field)}
        </WithDisplayPropertiesHOC>
      ))}
    </>
  );
}); 