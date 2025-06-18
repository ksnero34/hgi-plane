import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";

// types
import { TCustomField, TCustomFieldValue } from "@plane/types";

// hooks
import { useProject, useMember } from "@/hooks/store";

type Props = {
  customFields: TCustomField[];
  customFieldValues: {
    [key: string]: TCustomFieldValue;
  };
};

export const IssueDetailCustomFields: React.FC<Props> = observer((props) => {
  const { customFields, customFieldValues } = props;
  const { workspaceSlug, projectId } = useParams();

  const { getProjectById } = useProject();
  const {
    project: { getProjectMemberDetails },
  } = useMember();

  if (!customFields || customFields.length === 0) return null;

  const renderFieldValue = (field: TCustomField) => {
    const fieldValue = customFieldValues[field.id];
    if (!fieldValue) return "-";

    switch (field.field_type) {
      case "date":
        return fieldValue.value ? new Date(fieldValue.value).toLocaleDateString() : "-";

      case "select":
        return fieldValue.value || "-";

      case "multiselect":
        return Array.isArray(fieldValue.value) ? fieldValue.value.join(", ") : "-";

      case "project_member":
        if (fieldValue.value && projectId) {
          const memberDetails = getProjectMemberDetails(fieldValue.value, projectId as string);
          return memberDetails?.member?.display_name || 
                 memberDetails?.member?.first_name || 
                 memberDetails?.member?.email || 
                 fieldValue.value;
        }
        return "-";

      case "project_members":
        if (Array.isArray(fieldValue.value) && fieldValue.value.length > 0 && projectId) {
          const memberNames = fieldValue.value.map(memberId => {
            const memberDetails = getProjectMemberDetails(memberId, projectId as string);
            return memberDetails?.member?.display_name || 
                   memberDetails?.member?.first_name || 
                   memberDetails?.member?.email || 
                   memberId;
          });
          return memberNames.join(", ");
        }
        return "-";

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