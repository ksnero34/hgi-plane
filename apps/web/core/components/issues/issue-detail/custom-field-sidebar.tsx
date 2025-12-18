import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Tag, CalendarCheck2, UserCircle2, Users, MessageSquare } from "lucide-react";

// ui
import { DateDropdown, MemberDropdown } from "@/components/dropdowns";
import { CustomFieldDropdown } from "@/components/dropdowns/custom-field";

// types
import type { TCustomField } from "@plane/types";

// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useCustomField } from "@/hooks/store/use-custom-field";
import type { TIssueOperations } from "./root";
// helpers
import { renderFormattedPayloadDate } from "@plane/utils";
import { updateCustomFieldValueSafely, getCustomFieldValue } from "@plane/utils";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
};

export const IssueCustomFieldSidebar: React.FC<Props> = observer((props) => {
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable } = props;
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { customFields } = useCustomField(projectId);

  const issue = getIssueById(issueId);

  // 현재 이슈의 커스텀 필드 값 가져오기
  const getFieldValue = (fieldId: string) => {
    return getCustomFieldValue(issue?.custom_field_values || [], fieldId);
  };

  // 필드 값 업데이트 (peek-overview 방식 적용)
  const updateFieldValue = (fieldId: string, value: any) => {
    // console.log("[IssueCustomFieldSidebar] Updating field:", fieldId, "with value:", value);

    const field = customFields.find((f) => f.id === fieldId);
    if (!field) {
      console.error("[IssueCustomFieldSidebar] Field not found:", fieldId);
      return;
    }

    // 공통 유틸리티 함수 사용 (peek-overview 방식)
    const updatedValues = updateCustomFieldValueSafely(issue?.custom_field_values || [], fieldId, value, {
      name: field.name,
      field_type: field.field_type,
    });

    // console.log("[IssueCustomFieldSidebar] Final update values:", updatedValues);

    // 이슈 업데이트
    issueOperations.update(workspaceSlug, projectId, issueId, {
      custom_field_values: updatedValues,
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
      case "text":
        return MessageSquare;
      default:
        return Tag;
    }
  };

  const renderFieldInput = (field: TCustomField) => {
    const fieldValue = getFieldValue(field.id);

    switch (field.field_type) {
      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={(date) => updateFieldValue(field.id, date ? renderFormattedPayloadDate(date) : null)}
            placeholder="날짜 선택"
            disabled={!isEditable}
            buttonVariant="transparent-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
          />
        );

      case "select":
        return (
          <CustomFieldDropdown
            field={field}
            value={fieldValue}
            onChange={(val: string) => updateFieldValue(field.id, val)}
            buttonVariant="transparent-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            placeholder={`${field.name} 선택`}
            disabled={!isEditable}
            dropdownArrow
            showFieldNameWhenEmpty={true}
            hideIconWhenEmpty={true}
          />
        );

      case "multiselect":
        return (
          <CustomFieldDropdown
            field={field}
            value={fieldValue}
            onChange={(val: string[]) => updateFieldValue(field.id, val)}
            buttonVariant="transparent-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            placeholder={`${field.name} 선택`}
            disabled={!isEditable}
            dropdownArrow
            showFieldNameWhenEmpty={true}
            hideIconWhenEmpty={true}
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val: string | null) => updateFieldValue(field.id, val)}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            disabled={!isEditable}
            multiple={false}
            buttonVariant="transparent-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val: string[]) => updateFieldValue(field.id, val)}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            disabled={!isEditable}
            multiple
            buttonVariant="transparent-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
          />
        );

      default:
        return <span className="text-sm text-custom-text-400">지원하지 않는 필드 타입</span>;
    }
  };

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
