"use client";

import React, { useEffect, FC, useState } from "react";
import { observer } from "mobx-react";
import { Control, Controller } from "react-hook-form";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
// types
import { TIssue, TCustomField } from "@plane/types";
// ui
import { CustomSelect } from "@plane/ui";
import { DateDropdown, MemberDropdown } from "@/components/dropdowns";
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
    switch (field.field_type) {
      case "date":
        return (
          <DateDropdown
            value={value}
            onChange={(date) => {
              const formattedDate = date ? renderFormattedPayloadDate(date) : null;
              onChange({
                custom_field_id: field.id,
                value: formattedDate
              });
              handleFormChange();
            }}
            placeholder={field.name}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
          />
        );

      case "select":
        return (
          <CustomSelect
            value={value?.value}
            onChange={(val: string) => {
              onChange({
                custom_field_id: field.id,
                value: val
              });
              handleFormChange();
            }}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            label={value?.value || field.name}
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
            value={value?.value}
            onChange={(val: string[]) => {
              onChange({
                custom_field_id: field.id,
                value: val
              });
              handleFormChange();
            }}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            label={Array.isArray(value?.value) && value.value.length > 0 ? `${value.value.length}개 선택됨` : field.name}
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
            value={value?.value ? [value.value] : []}
            onChange={(val) => {
              onChange({
                custom_field_id: field.id,
                value: val && val.length > 0 ? val[0] : null
              });
              handleFormChange();
            }}
            projectId={projectId}
            placeholder={field.name}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            value={value?.value || []}
            onChange={(val) => {
              onChange({
                custom_field_id: field.id,
                value: val
              });
              handleFormChange();
            }}
            projectId={projectId}
            placeholder={field.name}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            multiple
          />
        );

      default:
        return null;
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