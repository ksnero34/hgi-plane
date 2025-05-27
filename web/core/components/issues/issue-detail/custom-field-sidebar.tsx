import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";

// ui
import { Input } from "@plane/ui";
import { CustomSelect, CustomDatePicker } from "@/components/ui";

// types
import { TCustomField } from "@plane/types";

// hooks
import { useCustomField, useProject } from "@/hooks/store";
import type { TIssueOperations } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
};

export const IssueCustomFieldSidebar: React.FC<Props> = observer((props) => {
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable } = props;

  const { getCustomFields, getCustomFieldValues } = useCustomField();
  const customFields = getCustomFields();
  const customFieldValues = getCustomFieldValues();

  const renderFieldInput = (field: TCustomField) => {
    const fieldValue = customFieldValues[field.id];

    switch (field.field_type) {
      case "text":
      case "url":
      case "email":
        return (
          <Input
            type={field.field_type === "email" ? "email" : "text"}
            value={fieldValue?.value || ""}
            onChange={(e) => {
              issueOperations.update(workspaceSlug, projectId, issueId, {
                custom_field_values: {
                  ...customFieldValues,
                  [field.id]: {
                    value: e.target.value,
                  },
                },
              });
            }}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            className="w-full"
            disabled={!isEditable}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={fieldValue?.value || ""}
            onChange={(e) => {
              issueOperations.update(workspaceSlug, projectId, issueId, {
                custom_field_values: {
                  ...customFieldValues,
                  [field.id]: {
                    value: parseFloat(e.target.value),
                  },
                },
              });
            }}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            className="w-full"
            disabled={!isEditable}
          />
        );

      case "date":
        return (
          <CustomDatePicker
            value={fieldValue?.value}
            onChange={(date) => {
              issueOperations.update(workspaceSlug, projectId, issueId, {
                custom_field_values: {
                  ...customFieldValues,
                  [field.id]: {
                    value: date,
                  },
                },
              });
            }}
            className="w-full"
            disabled={!isEditable}
          />
        );

      case "select":
        return (
          <CustomSelect
            value={fieldValue?.value}
            onChange={(val) => {
              issueOperations.update(workspaceSlug, projectId, issueId, {
                custom_field_values: {
                  ...customFieldValues,
                  [field.id]: {
                    value: val,
                  },
                },
              });
            }}
            options={field.options?.map((option) => ({
              value: option,
              label: option,
            }))}
            placeholder={`Select ${field.name.toLowerCase()}`}
            className="w-full"
            disabled={!isEditable}
          />
        );

      case "multiselect":
        return (
          <CustomSelect
            value={fieldValue?.value}
            onChange={(val) => {
              issueOperations.update(workspaceSlug, projectId, issueId, {
                custom_field_values: {
                  ...customFieldValues,
                  [field.id]: {
                    value: val,
                  },
                },
              });
            }}
            options={field.options?.map((option) => ({
              value: option,
              label: option,
            }))}
            placeholder={`Select ${field.name.toLowerCase()}`}
            isMulti
            className="w-full"
            disabled={!isEditable}
          />
        );

      default:
        return null;
    }
  };

  if (!customFields || customFields.length === 0) return null;

  return (
    <div className="space-y-4">
      {customFields.map((field) => (
        <div key={field.id} className="flex h-8 items-center gap-2">
          <div className="flex w-2/5 flex-shrink-0 items-center gap-1 text-sm text-custom-text-300">
            <span>
              {field.name}
              {field.is_required && <span className="text-red-500">*</span>}
            </span>
          </div>
          <div className="w-3/5 flex-grow">{renderFieldInput(field)}</div>
        </div>
      ))}
    </div>
  );
}); 