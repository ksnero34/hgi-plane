import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { Tag, CalendarCheck2, UserCircle2, Users, MessageSquare } from "lucide-react";

// ui
import { DateDropdown, MemberDropdown, CustomFieldDropdown } from "@/components/dropdowns";

// types
import type { TCustomField } from "@plane/types";
import type { TIssueOperations } from "@/components/issues/issue-detail";

// hooks
import { useCustomField } from "@/hooks/store/use-custom-field";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { renderFormattedPayloadDate } from "@plane/utils";

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

  const { customFields, isLoading: customFieldsLoading } = useCustomField(projectId);

  // derived values
  const issue = getIssueById(issueId);

  // console.log('Issue data:', {
  //   issueId: issueId,
  //   issue: issue,
  //   type_id: issue?.type_id,
  //   allIssueFields: issue ? Object.keys(issue) : 'no issue'
  // });

  // Filter custom fields based on current issue type
  const filteredCustomFields = customFields.filter((field) => {
    // console.log('Custom field filtering:', {
    //   fieldId: field.id,
    //   fieldName: field.name,
    //   fieldIssueType: field.issue_type,
    //   issueTypeId: issue?.type_id,
    //   match: field.issue_type === issue?.type_id
    // });

    // If custom field has no issue_type restriction, show for all issue types
    if (!field.issue_type) return true;
    // If issue has no type_id, don't show type-specific fields
    if (!issue?.type_id) return !field.issue_type;
    // Show only fields that match the current issue type
    return field.issue_type === issue.type_id;
  });

  const getFieldValue = (fieldId: string) => {
    const fieldValue = issue?.custom_field_values?.find((cfv) => cfv.custom_field_id === fieldId);
    return fieldValue?.value;
  };

  const updateFieldValue = (fieldId: string, value: any) => {
    const fieldArray = filteredCustomFields.filter((f) => f.id === fieldId);
    const field = fieldArray.length > 0 ? fieldArray[0] : null;
    issueOperations.update(workspaceSlug, projectId, issueId, {
      custom_field_values: [
        ...(issue?.custom_field_values || []).filter((cfv) => cfv.custom_field_id !== fieldId),
        {
          custom_field_id: fieldId,
          value: value,
          field_name: field?.name || "",
          field_type: field?.field_type || "",
        },
      ],
      updated_at: new Date().toISOString(),
    });
  };

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "text":
        return MessageSquare;
      case "date":
        return CalendarCheck2;
      case "select":
      case "multiselect":
        return Tag;
      case "project_member":
        return UserCircle2;
      case "project_members":
        return Users;
      default:
        return MessageSquare;
    }
  };

  const renderFieldInput = (field: TCustomField) => {
    const fieldValue = getFieldValue(field.id);

    switch (field.field_type) {
      case "text":
        return (
          <div className="w-3/4 flex-grow">
            <input
              type="text"
              defaultValue={fieldValue || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.dataset.updatedByEnter = "true";
                  const value = e.currentTarget.value.trim();
                  updateFieldValue(field.id, value || null);
                  e.currentTarget.blur();
                }
              }}
              onBlur={(e) => {
                if (e.currentTarget.dataset.updatedByEnter === "true") {
                  e.currentTarget.dataset.updatedByEnter = "false";
                  return;
                }
                const value = e.currentTarget.value.trim();
                updateFieldValue(field.id, value || null);
              }}
              placeholder={field.name}
              disabled={disabled}
              className="w-full px-2 py-0.5 text-sm bg-transparent border border-custom-border-200 rounded focus:outline-none focus:border-custom-primary-100 text-custom-text-200 placeholder:text-custom-text-400"
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
            onChange={(val: any) => updateFieldValue(field.id, val)}
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
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
              const newValue = fieldValue === val ? null : val;
              updateFieldValue(field.id, newValue);
            }}
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
            showUserDetails={true}
            multiple={false}
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val: string[]) => updateFieldValue(field.id, val)}
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
            showUserDetails={true}
          />
        );

      default:
        return (
          <div className="w-3/4 flex-grow">
            <div className="w-full h-full flex items-center gap-1.5 rounded px-2 py-0.5 text-sm justify-between cursor-not-allowed">
              <span className="flex-grow truncate text-xs leading-5 text-custom-text-400">지원하지 않는 필드 타입</span>
            </div>
          </div>
        );
    }
  };

  if (customFieldsLoading || !issue) return null;

  return (
    <>
      {filteredCustomFields.map((field) => {
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
