"use client";

import React, { useEffect, FC, useState } from "react";
import { observer } from "mobx-react";
import { Control, Controller } from "react-hook-form";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
// types
import { TIssue, TCustomField } from "@plane/types";
// ui
import { DateDropdown, MemberDropdown, CustomFieldDropdown } from "@/components/dropdowns";
// services
import { CustomFieldService } from "@/services/custom-field.service";
// helpers
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";

type Props = {
  control: Control<TIssue>;
  projectId: string;
  workspaceSlug: string;
  handleFormChange: () => void;
};

const customFieldService = new CustomFieldService();

export const IssueCustomField: FC<Props> = observer((props) => {
  const { control, projectId, workspaceSlug, handleFormChange } = props;
  // states
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // store hooks
  const { t } = useTranslation();

  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!projectId || !workspaceSlug) return;
      
      try {
        setIsLoading(true);
        const fields = await customFieldService.getCustomFields(workspaceSlug, projectId);
        setCustomFields(fields);
      } catch (error) {
        console.error("커스텀 필드 로드 중 오류:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomFields();
  }, [projectId, workspaceSlug]);

  if (isLoading || !customFields || customFields.length === 0) return null;

  const renderFieldInput = (field: TCustomField, value: any, onChange: (value: any) => void) => {
    const fieldValue = value?.value;
    
    switch (field.field_type) {
      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={(date) => {
              const formattedDate = date ? renderFormattedPayloadDate(date) : null;
              onChange({
                custom_field_id: field.id,
                value: formattedDate
              });
              handleFormChange();
            }}
            placeholder="날짜 선택"
            buttonVariant="border-with-text"
            className="w-full group"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            clearIconClassName="h-3 w-3 hidden group-hover:inline"
          />
        );

      case "select":
      case "multiselect":
        return (
          <CustomFieldDropdown
            field={field}
            value={fieldValue}
            onChange={(val) => {
              onChange({
                custom_field_id: field.id,
                value: val
              });
              handleFormChange();
            }}
            buttonVariant="border-with-text"
            className="w-full group"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            placeholder={field.name}
            showFieldNameWhenEmpty={true}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val) => {
              // 같은 값을 다시 클릭하면 값을 제거 (토글 기능)
              const newValue = fieldValue === val ? null : val;
              onChange({
                custom_field_id: field.id,
                value: newValue
              });
              handleFormChange();
            }}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            buttonVariant="border-with-text"
            className="w-full group"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            showUserDetails={true}
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val) => {
              onChange({
                custom_field_id: field.id,
                value: val
              });
              handleFormChange();
            }}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            buttonVariant="border-with-text"
            className="w-full group"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            showUserDetails={true}
            multiple
          />
        );

      default:
        return (
          <div className="w-full">
            <div className="w-full h-full flex items-center gap-1.5 rounded border border-custom-border-300 px-2 py-0.5 text-sm justify-between cursor-not-allowed">
              <span className="flex-grow truncate text-xs leading-5 text-custom-text-400">
                지원하지 않는 필드 타입
              </span>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {customFields.map((field) => (
        <Controller
          key={field.id}
          control={control}
          name={`custom_field_values.${field.id}` as any}
          render={({ field: formField }) => (
            <div className="h-7 flex items-center">
              {renderFieldInput(field, formField.value, formField.onChange)}
              {field.is_required && <span className="text-red-500 ml-1 text-xs">*</span>}
            </div>
          )}
        />
      ))}
    </>
  );
}); 