import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Tag, CalendarCheck2, UserCircle2, Users } from "lucide-react";

// ui
import { DateDropdown, MemberDropdown } from "@/components/dropdowns";
import { CustomSelect } from "@plane/ui";

// types
import { TCustomField } from "@plane/types";

// hooks
import { useIssueDetail } from "@/hooks/store";
import type { TIssueOperations } from "./root";
// helpers
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
};

export const IssueCustomFieldSidebar: React.FC<Props> = observer((props) => {
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable } = props;
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const issue = getIssueById(issueId);

  // 커스텀 필드 목록 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
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
      }
    };

    fetchCustomFields();
  }, [workspaceSlug, projectId]);

  // 현재 이슈의 커스텀 필드 값 가져오기
  const getFieldValue = (fieldId: string) => {
    return issue?.custom_field_values?.find(cfv => cfv.custom_field_id === fieldId)?.value;
  };

  const updateFieldValue = (fieldId: string, value: any) => {
    const updatedValues = [...(issue?.custom_field_values || [])];
    
    // 해당 필드의 값이 이미 있는지 확인
    const existingIndex = updatedValues.findIndex(cfv => cfv.custom_field_id === fieldId);
    
    if (existingIndex >= 0) {
      // 기존 값 업데이트
      updatedValues[existingIndex] = {
        ...updatedValues[existingIndex],
        value: value
      };
    } else {
      // 새로운 값 추가
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
      custom_field_values: updatedValues.map(cfv => ({
        custom_field_id: cfv.custom_field_id,
        value: cfv.value
      }))
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
          <CustomSelect
            value={fieldValue}
            onChange={(val) => updateFieldValue(field.id, val)}
            buttonVariant="transparent-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            placeholder={`${field.name} 선택`}
            disabled={!isEditable}
          >
            {field.options?.map((option) => (
              <CustomSelect.Option key={option} value={option}>
                {option}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        );

      case "multiselect":
        return (
          <CustomSelect
            value={fieldValue}
            onChange={(val) => updateFieldValue(field.id, val)}
            buttonVariant="transparent-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            placeholder={`${field.name} 선택`}
            disabled={!isEditable}
            multiple
          >
            {field.options?.map((option) => (
              <CustomSelect.Option key={option} value={option}>
                {option}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        );

      case "project_member":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val) => updateFieldValue(field.id, val)}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            disabled={!isEditable}
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
            onChange={(val) => updateFieldValue(field.id, val)}
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