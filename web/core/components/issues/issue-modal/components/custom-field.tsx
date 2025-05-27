"use client";

import React, { useEffect, FC } from "react";
import { observer } from "mobx-react";
import { Control, Controller } from "react-hook-form";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
// types
import { TIssue, TCustomField, TCustomFieldType } from "@plane/types";
// ui
import { Input, CustomSelect } from "@plane/ui";
import { DateDropdown, MemberDropdown } from "@/components/dropdowns";
// hooks
import { useCustomField, useProject } from "@/hooks/store";

type Props = {
  control: Control<TIssue>;
  projectId: string;
  workspaceSlug: string;
  handleFormChange: () => void;
};

export const IssueCustomField: FC<Props> = observer((props) => {
  const { control, projectId, workspaceSlug, handleFormChange } = props;
  // store hooks
  const { t } = useTranslation();
  const customFieldStore = useCustomField();
  const { getProjectById } = useProject();

  useEffect(() => {
    if (projectId && workspaceSlug) {
      customFieldStore.fetchCustomFields(workspaceSlug, projectId);
    }
  }, [projectId, workspaceSlug, customFieldStore]);

  const customFields = customFieldStore.getCustomFields();

  if (!customFields || customFields.length === 0) return null;

  const renderFieldInput = (field: TCustomField) => {
    switch (field.field_type) {
      case "text":
      case "url":
      case "email":
        return (
          <CustomSelect
            value={field.value}
            onChange={(val: string) => {
              field.onChange(val);
              handleFormChange();
            }}
            options={field.settings?.predefined_values?.map((value) => ({
              value,
              label: value,
            })) || []}
            placeholder={field.name}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            createable
          />
        );

      case "number":
        return (
          <CustomSelect
            value={field.value?.toString()}
            onChange={(val: string) => {
              const value = parseFloat(val);
              if (field.settings?.min_value !== undefined && value < field.settings.min_value) return;
              if (field.settings?.max_value !== undefined && value > field.settings.max_value) return;
              field.onChange(value);
              handleFormChange();
            }}
            options={field.settings?.predefined_values?.map((value) => ({
              value: value.toString(),
              label: value.toString(),
            })) || []}
            placeholder={field.name}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            createable
          />
        );

      case "date":
        return (
          <DateDropdown
            value={field.value}
            onChange={(date) => {
              field.onChange(date);
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
            value={field.value}
            onChange={(val: string) => {
              field.onChange(val);
              handleFormChange();
            }}
            options={field.options?.map((option) => ({
              value: option,
              label: option,
            })) || []}
            placeholder={field.name}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
          />
        );

      case "multiselect":
        return (
          <CustomSelect
            value={field.value}
            onChange={(val: string[]) => {
              field.onChange(val);
              handleFormChange();
            }}
            options={field.options?.map((option) => ({
              value: option,
              label: option,
            })) || []}
            placeholder={field.name}
            buttonVariant="border-with-text"
            className="w-full"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            multiple
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            value={field.value}
            onChange={(val) => {
              field.onChange(val);
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
            value={field.value}
            onChange={(val) => {
              field.onChange(val);
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
    <div className="flex flex-wrap items-center gap-2">
      {customFields.map((field) => (
        <Controller
          key={field.id}
          control={control}
          name={`custom_field_values.${field.id}`}
          render={({ field: formField }) => (
            <div className="h-7">
              {renderFieldInput({
                ...field,
                value: formField.value,
                onChange: formField.onChange,
              })}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </div>
          )}
        />
      ))}
    </div>
  );
}); 