import type React from "react";

import { observer } from "mobx-react";
import { useFormContext } from "react-hook-form";
import { useMemo } from "react";
import { Tag, CalendarCheck2, UserCircle2, Users, MessageSquare } from "lucide-react";
import type { TIssue, TCustomField } from "@plane/types";
// components
import { DateDropdown, MemberDropdown, CustomFieldDropdown } from "@/components/dropdowns";
// hooks
import { useCustomField } from "@/hooks/store/use-custom-field";
import { useIssueType } from "@/hooks/store/use-issue-type";
import { renderFormattedPayloadDate } from "@plane/utils";

export type TWorkItemModalAdditionalPropertiesProps = {
  isDraft?: boolean;
  projectId: string | null;
  workItemId: string | undefined;
  workspaceSlug: string;
};

export const WorkItemModalAdditionalProperties = observer((props: TWorkItemModalAdditionalPropertiesProps) => {
  const { projectId, workItemId } = props;

  if (!projectId) return null;

  const { control, watch, setValue } = useFormContext<TIssue>();
  const { customFields, isLoading } = useCustomField(projectId);
  const { issueTypes } = useIssueType(projectId);

  // 현재 선택된 type_id 가져오기
  const currentTypeId = watch("type_id");

  // type_id에 해당하는 ProjectIssueType 찾기 (useMemo로 캐싱)
  const currentProjectIssueType = useMemo(() => {
    if (!issueTypes || !currentTypeId) return null;
    return issueTypes.find((it) => it.id === currentTypeId);
  }, [issueTypes, currentTypeId]);

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "text":
      case "number":
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

  const renderFieldInput = (field: TCustomField, value: any, onChange: (value: any) => void) => {
    switch (field.field_type) {
      case "text":
        return (
          <div className="w-3/4 flex-grow">
            <input
              type="text"
              value={value?.value || ""}
              onChange={(e) =>
                onChange({
                  custom_field_id: field.id,
                  value: e.target.value,
                })
              }
              placeholder={field.name}
              className="w-full px-2 py-0.5 text-sm bg-transparent border border-custom-border-200 rounded focus:outline-none focus:border-custom-primary-100 text-custom-text-200 placeholder:text-custom-text-400"
            />
          </div>
        );

      case "number":
        return (
          <div className="w-3/4 flex-grow">
            <input
              type="number"
              value={value?.value || ""}
              onChange={(e) =>
                onChange({
                  custom_field_id: field.id,
                  value: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder={field.name}
              className="w-full px-2 py-0.5 text-sm bg-transparent border border-custom-border-200 rounded focus:outline-none focus:border-custom-primary-100 text-custom-text-200 placeholder:text-custom-text-400"
            />
          </div>
        );

      case "date":
        return (
          <DateDropdown
            value={value?.value || null}
            onChange={(date) =>
              onChange({
                custom_field_id: field.id,
                value: date ? renderFormattedPayloadDate(date) : null,
              })
            }
            placeholder="날짜 선택"
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${value?.value ? "" : "text-custom-text-400"}`}
            hideIcon
            clearIconClassName="h-3 w-3 hidden group-hover:inline"
          />
        );

      case "select":
      case "multiselect":
        return (
          <CustomFieldDropdown
            field={field}
            value={value?.value || (field.field_type === "multiselect" ? [] : null)}
            onChange={(val) =>
              onChange({
                custom_field_id: field.id,
                value: val,
              })
            }
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${value?.value ? "" : "text-custom-text-400"}`}
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
            value={value?.value || null}
            onChange={(memberId) => {
              const newValue = value?.value === memberId ? null : memberId;
              onChange({
                custom_field_id: field.id,
                value: newValue,
              });
            }}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${value?.value ? "" : "text-custom-text-400"}`}
            hideIcon={!value?.value}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
            showUserDetails={true}
            multiple={false}
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            value={value?.value || []}
            onChange={(memberIds) =>
              onChange({
                custom_field_id: field.id,
                value: memberIds,
              })
            }
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            multiple
            buttonVariant="transparent-with-text"
            className="w-3/4 flex-grow group"
            buttonContainerClassName="w-full text-left"
            buttonClassName={`text-sm ${value?.value && value.value.length > 0 ? "" : "text-custom-text-400"}`}
            hideIcon={!value?.value || value.value.length === 0}
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

  // ProjectIssueType의 id(커스텀 필드의 issue_type)에 해당하는 커스텀 필드만 필터링 (useMemo로 캐싱)
  const filteredCustomFields = useMemo(() => {
    if (!currentProjectIssueType || !customFields) return [];
    return customFields.filter((field) => {
      if (!field.issue_type) return false;
      // 커스텀 필드의 issue_type과 현재 선택된 ProjectIssueType의 id가 매칭되는지 확인
      return field.issue_type === currentProjectIssueType.id;
    });
  }, [customFields, currentProjectIssueType]);

  // 데이터가 로딩 중이거나, issue type이 선택되지 않았거나, 필터링된 커스텀 필드가 없으면 렌더링하지 않음
  if (isLoading || !currentTypeId || !currentProjectIssueType || filteredCustomFields.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <div className="space-y-3">
        {filteredCustomFields.map((field) => {
          const FieldIcon = getFieldIcon(field.field_type);

          return (
            <div key={field.id} className="flex w-full items-center gap-3 h-8">
              <div className="flex items-center gap-1 w-1/4 flex-shrink-0 text-sm text-custom-text-300">
                <FieldIcon className="h-4 w-4 flex-shrink-0" />
                <span>{field.name}</span>
                {field.is_required && <span className="text-red-500 ml-1">*</span>}
              </div>
              {renderFieldInput(field, watch(`custom_field_values.${field.id}` as any), (value) =>
                setValue(`custom_field_values.${field.id}` as any, value)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
