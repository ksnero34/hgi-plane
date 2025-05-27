import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";

// types
import { TCustomField, TCustomFieldValue } from "@plane/types";

// hooks
import { useProject } from "@/hooks/store";

type Props = {
  customFields: TCustomField[];
  customFieldValues: {
    [key: string]: TCustomFieldValue;
  };
};

export const IssueDetailCustomFields: React.FC<Props> = observer((props) => {
  const { customFields, customFieldValues } = props;
  const { workspaceSlug } = useParams();

  const { getProjectById } = useProject();

  if (!customFields || customFields.length === 0) return null;

  const renderFieldValue = (field: TCustomField) => {
    const fieldValue = customFieldValues[field.id];
    if (!fieldValue) return "-";

    switch (field.field_type) {
      case "text":
      case "url":
      case "email":
      case "number":
        return fieldValue.value || "-";

      case "date":
        return fieldValue.value ? new Date(fieldValue.value).toLocaleDateString() : "-";

      case "select":
        return fieldValue.value || "-";

      case "multiselect":
        return Array.isArray(fieldValue.value) ? fieldValue.value.join(", ") : "-";

      case "project_member":
        return fieldValue.value ? "TODO: Show member name" : "-";

      case "project_members":
        return Array.isArray(fieldValue.value) ? "TODO: Show member names" : "-";

      default:
        return "-";
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">커스텀 필드</h3>
      <div className="space-y-3">
        {customFields.map((field) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="min-w-[180px]">
              <span className="text-sm text-custom-text-400">{field.name}</span>
            </div>
            <div className="flex-1">
              <span className="text-sm">{renderFieldValue(field)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}); 