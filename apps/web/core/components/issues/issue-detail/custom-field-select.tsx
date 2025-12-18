import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { Tag, CalendarCheck2, UserCircle2, Users, MessageSquare } from "lucide-react";

// ui
import { DateDropdown, MemberDropdown, CustomFieldDropdown } from "@/components/dropdowns";

// types
import type { TCustomField } from "@plane/types";
import type { TIssueOperations } from "@/components/issues/issue-detail";

// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useCustomField } from "@/hooks/store/use-custom-field";
import { renderFormattedPayloadDate } from "@plane/utils";
// helpers
import { updateCustomFieldValueSafely, getCustomFieldValue } from "@plane/utils";

type TIssueCustomFieldSelect = {
  className?: string;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled?: boolean;
};

export const IssueCustomFieldSelect: React.FC<TIssueCustomFieldSelect> = observer((props) => {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled = false } = props;

  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  // derived values
  const issue = getIssueById(issueId);

  // 이슈에서 실제 프로젝트 ID 가져오기 (워크스페이스 레벨에서도 작동)
  const actualProjectId = issue?.project_id || projectId;

  const { customFields, isLoading } = useCustomField(actualProjectId);

  // 특정 필드의 현재 값 가져오기
  const getFieldValue = (fieldId: string) => {
    return getCustomFieldValue(issue?.custom_field_values || [], fieldId);
  };

  // 필드 값 업데이트
  const updateFieldValue = (fieldId: string, value: any) => {
    const field = customFields.find((f) => f.id === fieldId);
    if (!field) {
      console.error("[IssueCustomFieldSelect] Field not found:", fieldId);
      return;
    }

    // 공통 유틸리티 함수 사용
    const updatedValues = updateCustomFieldValueSafely(issue?.custom_field_values || [], fieldId, value, {
      name: field.name,
      field_type: field.field_type,
    });

    // 이슈 업데이트 - 실제 프로젝트 ID 사용
    issueOperations.update(workspaceSlug, actualProjectId, issueId, {
      custom_field_values: updatedValues,
    });
  };

  // 필드 타입에 따른 아이콘 선택
  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "text":
        return MessageSquare;
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
      case "text":
        return (
          <div className="w-3/5 flex-grow">
            <input
              type="text"
              defaultValue={fieldValue || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // 엔터키로 업데이트했음을 먼저 표시
                  e.currentTarget.dataset.updatedByEnter = "true";
                  const value = e.currentTarget.value.trim();
                  updateFieldValue(field.id, value || null);
                  e.currentTarget.blur();
                }
              }}
              onBlur={(e) => {
                // 엔터키로 이미 업데이트했다면 onBlur에서는 실행하지 않음
                if (e.currentTarget.dataset.updatedByEnter === "true") {
                  e.currentTarget.dataset.updatedByEnter = "false";
                  return;
                }
                const value = e.currentTarget.value.trim();
                updateFieldValue(field.id, value || null);
              }}
              placeholder={field.name}
              disabled={disabled}
              className="w-full px-2 py-1 text-sm bg-transparent border border-custom-border-200 rounded focus:outline-none focus:border-custom-primary-100 text-custom-text-200 placeholder:text-custom-text-400"
            />
          </div>
        );

      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={(date) => updateFieldValue(field.id, date ? renderFormattedPayloadDate(date) : null)}
            placeholder="날짜 선택"
            disabled={disabled}
            buttonVariant="transparent-with-text"
            className="w-3/5 flex-grow group"
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
            onChange={(val: any) => updateFieldValue(field.id, val)}
            buttonVariant="transparent-with-text"
            className="w-3/5 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            disabled={disabled}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            placeholder={field.name}
            showFieldNameWhenEmpty={true}
            hideIconWhenEmpty={true}
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val: string | null) => {
              // 같은 값을 다시 클릭하면 값을 제거 (토글 기능)
              const newValue = fieldValue === val ? null : val;
              updateFieldValue(field.id, newValue);
            }}
            projectId={actualProjectId}
            placeholder={`${field.name} 선택`}
            disabled={disabled}
            multiple={false}
            buttonVariant="transparent-with-text"
            className="w-3/5 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            hideIcon={!fieldValue}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            showUserDetails={true}
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val: string[]) => updateFieldValue(field.id, val)}
            projectId={actualProjectId}
            placeholder={`${field.name} 선택`}
            disabled={disabled}
            multiple={true}
            buttonVariant="transparent-with-text"
            className="w-3/5 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${fieldValue ? "" : "text-custom-text-400"}`}
            hideIcon={!fieldValue}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            showUserDetails={true}
          />
        );

      default:
        return <span className="text-sm text-custom-text-400">지원하지 않는 필드 타입</span>;
    }
  };

  // 커스텀 필드가 없으면 아무것도 렌더링하지 않음
  if (!customFields || customFields.length === 0) {
    return null;
  }

  return (
    <>
      {customFields.map((field) => {
        const FieldIcon = getFieldIcon(field.field_type);

        return (
          <div key={field.id} className="flex h-8 items-center gap-2">
            <div className="flex w-2/5 flex-shrink-0 items-center gap-1 text-sm text-custom-text-300">
              <FieldIcon className="h-4 w-4 flex-shrink-0" />
              <span>
                {field.name}
                {field.is_required && <span className="text-red-500">*</span>}
              </span>
            </div>
            <div className="w-3/5 flex-grow">{renderFieldInput(field)}</div>
          </div>
        );
      })}
    </>
  );
});
