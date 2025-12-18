import React from "react";
import { observer } from "mobx-react";
import { Tag, CalendarCheck2, UserCircle2, Users, MessageSquare } from "lucide-react";

// types
import type { TCustomField } from "@plane/types";
import type { IIssue } from "@/types/issue";

// hooks
import { usePublish } from "@/hooks/store/publish";
import { StoreContext } from "@/lib/store-provider";

type TCustomFieldProperties = {
  anchor: string;
  issue: IIssue;
  customFields: TCustomField[];
};

export const CustomFieldProperties: React.FC<TCustomFieldProperties> = observer((props) => {
  const { anchor, issue, customFields } = props;

  // store hooks
  const { member } = React.useContext(StoreContext);
  const { project } = usePublish(anchor);

  const project_members = member.members?.filter((m) => m.project === project);

  const getFieldValue = (fieldId: string) => {
    const fieldValue = (issue as any)?.custom_field_values?.find((cfv: any) => cfv.custom_field_id === fieldId);
    return fieldValue?.value;
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

  const renderFieldValue = (field: TCustomField) => {
    const fieldValue = getFieldValue(field.id);

    if (!fieldValue) return null;

    switch (field.field_type) {
      case "text":
        return <span className="text-sm text-custom-text-200">{fieldValue}</span>;

      case "date":
        return <span className="text-sm text-custom-text-200">{new Date(fieldValue).toLocaleDateString()}</span>;

      case "select":
        const selectOption = (field.options as unknown as { value: string; label: string; color: string }[])?.find(
          (opt) => opt.value === fieldValue
        );
        return selectOption ? (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectOption.color }} />
            <span className="text-sm text-custom-text-200">{selectOption.label}</span>
          </div>
        ) : null;

      case "multiselect":
        const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
        return (
          <div className="flex flex-wrap gap-1">
            {values.map((value, index) => {
              const option = (field.options as unknown as { value: string; label: string; color: string }[])?.find(
                (opt) => opt.value === value
              );
              return option ? (
                <div key={index} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: option.color }} />
                  <span className="text-xs text-custom-text-200">{option.label}</span>
                </div>
              ) : null;
            })}
          </div>
        );

      case "project_member":
        const member = project_members?.find((m) => m.member === fieldValue);
        return member ? (
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-custom-background-80 flex items-center justify-center">
              <span className="text-xs text-custom-text-200">
                {member.member__display_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-custom-text-200">{member.member__display_name}</span>
          </div>
        ) : null;

      case "project_members":
        const memberIds = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
        return (
          <div className="flex flex-wrap gap-1">
            {memberIds.map((memberId, index) => {
              const member = project_members?.find((m) => m.member === memberId);
              return member ? (
                <div key={index} className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-custom-background-80 flex items-center justify-center">
                    <span className="text-xs text-custom-text-200">
                      {member.member__display_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-custom-text-200">{member.member__display_name}</span>
                </div>
              ) : null;
            })}
          </div>
        );

      default:
        return <span className="text-sm text-custom-text-200">{String(fieldValue)}</span>;
    }
  };

  if (!customFields || customFields.length === 0) return null;

  return (
    <div className="space-y-2">
      {customFields.map((field) => {
        const fieldValue = getFieldValue(field.id);
        if (!fieldValue) return null;

        const Icon = getFieldIcon(field.field_type);

        return (
          <div key={field.id} className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-custom-text-400" />
            <span className="text-sm text-custom-text-300 min-w-0 flex-shrink-0">{field.name}:</span>
            <div className="flex-1 min-w-0">{renderFieldValue(field)}</div>
          </div>
        );
      })}
    </div>
  );
});
